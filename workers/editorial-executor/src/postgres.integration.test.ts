import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTaskRequest, type TaskExecutionContext } from '@plataforma/task-runtime'
import { PostgresTaskRunStore } from '@plataforma/task-runtime/postgres-store'
import type { TaskSqlPool } from '@plataforma/task-runtime/postgres-store'
import { EditorialTaskSupervisor } from '@plataforma/task-runtime/supervisor'
import { createNewsRadarTaskHandler } from '@plataforma/worker-news-radar/runtime'
import { createInboxRetentionCleanupTaskHandler } from './inbox.js'

const testDatabaseUrl = process.env.TASK_RUNTIME_TEST_DATABASE_URL
const integration = describe.skipIf(!testDatabaseUrl)

integration('PostgreSQL editorial task executor', () => {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 6 })
  const store = new PostgresTaskRunStore(pool as unknown as TaskSqlPool)

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname.slice(1)
    if (!databaseName.startsWith('codex_task_runtime_test_')) throw new Error('Integration tests require a disposable database named codex_task_runtime_test_*')
    await pool.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS public.runtime_controls(control_key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now())`)
    await pool.query(`CREATE TABLE IF NOT EXISTS public.worker_heartbeats(worker text NOT NULL, instance_id text NOT NULL, last_beat_at timestamptz, jobs_done_window integer, jobs_failed_window integer, backlog_seen integer, p95_latency_ms numeric, state text, PRIMARY KEY(worker,instance_id))`)
    const applied = await pool.query<{ version: string }>(`SELECT version FROM public.schema_migrations WHERE version IN ('0045_task_runtime','0049_durable_task_executor','0050_meta_inbox_events')`)
    const versions = new Set(applied.rows.map(row => row.version))
    const migrations = path.resolve(process.cwd(), '../../packages/db/migrations')
    if (!versions.has('0045_task_runtime')) {
      await pool.query(await readFile(path.join(migrations, '0045_task_runtime.up.sql'), 'utf8'))
      await pool.query(`INSERT INTO public.schema_migrations(version) VALUES('0045_task_runtime') ON CONFLICT DO NOTHING`)
    }
    if (!versions.has('0049_durable_task_executor')) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS editorial`)
      await pool.query(`ALTER TABLE public.task_runs SET SCHEMA editorial`)
      await pool.query(`ALTER TABLE public.task_schedules SET SCHEMA editorial`)
      await pool.query(await readFile(path.join(migrations, '0049_durable_task_executor.up.sql'), 'utf8'))
      await pool.query(`INSERT INTO public.schema_migrations(version) VALUES('0049_durable_task_executor') ON CONFLICT DO NOTHING`)
    }
    if (!versions.has('0050_meta_inbox_events')) {
      await pool.query(await readFile(path.join(migrations, '0050_meta_inbox_events.up.sql'), 'utf8'))
      await pool.query(`INSERT INTO public.schema_migrations(version) VALUES('0050_meta_inbox_events') ON CONFLICT DO NOTHING`)
    }
  })

  beforeEach(async () => {
    await pool.query(`TRUNCATE editorial.task_run_audit,editorial.task_outbox,editorial.task_runs RESTART IDENTITY CASCADE`)
    await pool.query(`TRUNCATE editorial.social_inbox_events RESTART IDENTITY CASCADE`)
    await pool.query(`UPDATE editorial.task_schedules SET enabled=false`)
    await pool.query(`DELETE FROM public.runtime_controls WHERE control_key='kill-switch:global'`)
  })

  afterAll(async () => { await pool.end() })

  it('creates a disabled retention schedule and deduplicates inbox revisions', async () => {
    const schedule = await pool.query<{ enabled: boolean; destination: string; lane: string }>(
      `SELECT enabled,destination,lane FROM editorial.task_schedules WHERE task_name='inbox.retention.cleanup'`,
    )
    expect(schedule.rows[0]).toEqual({ enabled: false, destination: 'local', lane: 'default' })

    const insertEvent = (revisionHash: string) => pool.query<{ id: string }>(
      `INSERT INTO editorial.social_inbox_events(
         provider,channel,account_external_id,event_kind,external_event_id,revision_hash,
         content_type,text_content,provider_event_at,reply_window_expires_at
       ) VALUES('meta','instagram','account-1','comment','comment-1',$1,'text','A feira foi adiada?',now(),now()+interval '7 days')
       ON CONFLICT(provider,channel,account_external_id,event_kind,external_event_id,revision_hash) DO NOTHING
       RETURNING id`,
      [revisionHash],
    )

    const first = await insertEvent('a'.repeat(64))
    const duplicate = await insertEvent('a'.repeat(64))
    const editedRevision = await insertEvent('b'.repeat(64))
    expect(first.rows).toHaveLength(1)
    expect(duplicate.rows).toHaveLength(0)
    expect(editedRevision.rows).toHaveLength(1)
    expect(editedRevision.rows[0]?.id).not.toBe(first.rows[0]?.id)
  })

  it('redacts personal data at 30 days and removes dedupe rows at 180 days', async () => {
    await pool.query(
      `INSERT INTO editorial.social_inbox_events(
         provider,channel,account_external_id,event_kind,external_event_id,revision_hash,
         sender_external_id,content_type,text_content,status,personal_data_expires_at,dedupe_expires_at
       ) VALUES
         ('meta','instagram','account-1','direct_message','dm-redact',repeat('c',64),'sender-1','text','Oi, preciso de ajuda','pending_triage',now()-interval '1 day',now()+interval '1 day'),
         ('meta','instagram','account-1','direct_message','dm-delete',repeat('d',64),'sender-2','text','Meu dado pessoal','needs_human_review',now()-interval '181 days',now()-interval '1 day')
       RETURNING id`,
    )
    const handler = createInboxRetentionCleanupTaskHandler(pool)
    const result = await handler(makeTaskRequest('inbox.retention.cleanup', {}, { occurrenceKey: 'retention-cleanup-fixture' }), {} as TaskExecutionContext)
    expect(result.result).toEqual({ redacted: 2, deleted: 1 })
    const retained = await pool.query<{ text_content: string | null; sender_external_id: string | null; status: string; redacted_at: Date | null }>(
      `SELECT text_content,sender_external_id,status,redacted_at FROM editorial.social_inbox_events WHERE external_event_id='dm-redact'`,
    )
    expect(retained.rows[0]).toMatchObject({ text_content: null, sender_external_id: null, status: 'expired', redacted_at: expect.any(Date) })
    const deleted = await pool.query(`SELECT id FROM editorial.social_inbox_events WHERE external_event_id='dm-delete'`)
    expect(deleted.rows).toHaveLength(0)
  })

  it('keeps simultaneous publication items and revisions distinct by account scope', async () => {
    const scheduledAt = '2026-09-28T12:00:00.000Z'
    const inputs = [
      makeTaskRequest('publication.due', { safeRef: 'a' }, { scheduleTime: scheduledAt, accountId: '10000000-0000-4000-8000-000000000001', itemId: '20000000-0000-4000-8000-000000000001', revisionId: '30000000-0000-4000-8000-000000000001' }),
      makeTaskRequest('publication.due', { safeRef: 'b' }, { scheduleTime: scheduledAt, accountId: '10000000-0000-4000-8000-000000000001', itemId: '20000000-0000-4000-8000-000000000002', revisionId: '30000000-0000-4000-8000-000000000001' }),
      makeTaskRequest('publication.due', { safeRef: 'c' }, { scheduleTime: scheduledAt, accountId: '10000000-0000-4000-8000-000000000001', itemId: '20000000-0000-4000-8000-000000000001', revisionId: '30000000-0000-4000-8000-000000000002' }),
    ]
    const inserted = await Promise.all(inputs.map(request => store.enqueue(request)))
    expect(inserted.every(item => item.accepted)).toBe(true)
    expect(new Set(inserted.map(item => item.runId)).size).toBe(3)
    await expect(store.enqueue(inputs[0]!)).resolves.toMatchObject({ accepted: false, runId: inserted[0]!.runId })
  })

  it('recovers an expired worker lease and resumes from its durable checkpoint', async () => {
    const request = makeTaskRequest('news-radar.daily', { mode: 'incremental' }, { occurrenceKey: 'recovery-checkpoint-1' })
    const queued = await store.enqueue(request)
    const firstClaim = await store.claimNext(['heavy'], 'executor-before-restart', 10_000)
    expect(firstClaim?.id).toBe(queued.runId)
    await store.checkpoint(queued.runId, 'executor-before-restart', { phase: 'collect', lastSourceId: 'source-9' })
    await pool.query(`UPDATE editorial.task_runs SET lease_until=now()-interval '1 second' WHERE id=$1::uuid`, [queued.runId])

    await expect(store.recoverExpiredLeases()).resolves.toBe(1)
    const resumed = await store.claimNext(['heavy'], 'executor-after-restart', 10_000)
    expect(resumed).toMatchObject({ id: queued.runId, attempt: 2, checkpoint: { phase: 'collect', lastSourceId: 'source-9' } })
    await store.complete(queued.runId, 'executor-after-restart', {
      result: { processed: 9 },
      events: [{ eventKey: `${request.idempotencyKey}:done`, eventType: 'news-radar.completed', payload: { processed: 9 } }],
    })
    const persisted = await pool.query<{ status: string; result: { processed: number } }>(`SELECT status,result FROM editorial.task_runs WHERE id=$1::uuid`, [queued.runId])
    const outbox = await pool.query<{ status: string; event_type: string }>(`SELECT status,event_type FROM editorial.task_outbox WHERE run_id=$1::uuid`, [queued.runId])
    expect(persisted.rows[0]).toMatchObject({ status: 'completed', result: { processed: 9 } })
    expect(outbox.rows[0]).toMatchObject({ status: 'pending', event_type: 'news-radar.completed' })
  })

  it('retries failed work and claims publishing while the heavy lane is occupied', async () => {
    const heavy = await store.enqueue(makeTaskRequest('news-radar.daily', {}, { occurrenceKey: 'heavy-lane' }))
    const publishing = await store.enqueue(makeTaskRequest('publication.due', {}, {
      scheduleTime: new Date(Date.now() - 60_000).toISOString(),
      accountId: '10000000-0000-4000-8000-000000000002',
      itemId: '20000000-0000-4000-8000-000000000003',
      revisionId: '30000000-0000-4000-8000-000000000003',
    }))
    const heavyClaim = await store.claimNext(['heavy'], 'lane-test', 10_000)
    expect(heavyClaim?.id).toBe(heavy.runId)
    await store.checkpoint(heavy.runId, 'lane-test', { phase: 'classified', lastItemId: 'item-7' })
    await store.fail(heavy.runId, 'lane-test', 'intentional checkpoint test failure', new Date(Date.now() - 1_000).toISOString())
    const publishingClaim = await store.claimNext(['publishing'], 'lane-test', 10_000)
    expect(publishingClaim?.id).toBe(publishing.runId)
    const retriedHeavy = await store.claimNext(['heavy'], 'lane-test', 10_000)
    expect(retriedHeavy).toMatchObject({ id: heavy.runId, attempt: 2, checkpoint: { phase: 'classified', lastItemId: 'item-7' } })

    const beforeCheckpoint = await store.enqueue(makeTaskRequest('news-radar.daily', {}, { occurrenceKey: 'retry-before-checkpoint' }))
    const firstAttempt = await store.claimNext(['heavy'], 'lane-test', 10_000)
    expect(firstAttempt).toMatchObject({ id: beforeCheckpoint.runId, attempt: 1, checkpoint: null })
    await store.fail(beforeCheckpoint.runId, 'lane-test', 'intentional failure before checkpoint', new Date(Date.now() - 1_000).toISOString())
    const secondAttempt = await store.claimNext(['heavy'], 'lane-test', 10_000)
    expect(secondAttempt).toMatchObject({ id: beforeCheckpoint.runId, attempt: 2, checkpoint: null })
    await store.complete(beforeCheckpoint.runId, 'lane-test', { result: { restartedFromBeginning: true } })
  })

  it('materializes enabled due schedules once with their lane and priority', async () => {
    const scheduledAt = new Date(Date.now() - 60_000)
    await pool.query(
      `UPDATE editorial.task_schedules SET enabled=true,destination='local',next_run_at=$1::timestamptz WHERE task_name='news-radar.daily'`,
      [scheduledAt.toISOString()],
    )

    await expect(store.materializeDueSchedules(new Date(), 20)).resolves.toBe(1)
    await expect(store.materializeDueSchedules(new Date(), 20)).resolves.toBe(0)
    const run = await pool.query<{ task_name: string; lane: string; priority: number; schedule_time: Date }>(
      `SELECT task_name,lane,priority,schedule_time FROM editorial.task_runs WHERE idempotency_key=$1`,
      [`schedule:news-radar.daily:${scheduledAt.toISOString()}`],
    )
    expect(run.rows[0]).toMatchObject({ task_name: 'news-radar.daily', lane: 'heavy', priority: 30 })
    expect(new Date(run.rows[0]!.schedule_time).toISOString()).toBe(scheduledAt.toISOString())
  })

  it('runs publication while a heavy handler is blocked and drains both on shutdown', async () => {
    const heavy = await store.enqueue(makeTaskRequest('news-radar.daily', {}, { occurrenceKey: 'supervisor-heavy' }))
    const publication = await store.enqueue(makeTaskRequest('publication.due', {}, {
      scheduleTime: new Date(Date.now() - 60_000).toISOString(),
      accountId: '10000000-0000-4000-8000-000000000003',
      itemId: '20000000-0000-4000-8000-000000000004',
      revisionId: '30000000-0000-4000-8000-000000000004',
    }))

    let releaseHeavy!: () => void
    let signalHeavyStarted!: () => void
    let signalPublicationStarted!: () => void
    const heavyGate = new Promise<void>(resolve => { releaseHeavy = resolve })
    const heavyStarted = new Promise<void>(resolve => { signalHeavyStarted = resolve })
    const publicationStarted = new Promise<void>(resolve => { signalPublicationStarted = resolve })
    const supervisor = new EditorialTaskSupervisor(store, {
      owner: 'supervisor-integration-test',
      handlers: {
        'news-radar.daily': async () => {
          signalHeavyStarted()
          await heavyGate
          return { result: { ok: true, lane: 'heavy' } }
        },
        'publication.due': async () => {
          signalPublicationStarted()
          return { result: { ok: true, lane: 'publishing' } }
        },
      },
      pollIntervalMs: 60_000,
      heartbeatIntervalMs: 60_000,
      leaseMs: 10_000,
      shutdownGraceMs: 1_000,
      onError: error => { throw error },
    })

    try {
      await supervisor.start()
      await Promise.all([heavyStarted, publicationStarted])
      await waitForRunStatus(pool, publication.runId, 'completed')
      const heavyWhilePublishingCompleted = await pool.query<{ status: string }>(`SELECT status FROM editorial.task_runs WHERE id=$1::uuid`, [heavy.runId])
      expect(heavyWhilePublishingCompleted.rows[0]?.status).toBe('running')
      releaseHeavy()
      await supervisor.stop()
      await waitForRunStatus(pool, heavy.runId, 'completed')
      const heartbeat = await pool.query<{ state: string }>(`SELECT state FROM public.worker_heartbeats WHERE worker='editorial-executor' AND instance_id=$1`, [supervisor.owner])
      expect(heartbeat.rows[0]?.state).toBe('stopped')
    } finally {
      releaseHeavy()
      await supervisor.stop()
    }
  })

  it('runs the real news-radar handler against a local feed and persists its checkpoint and result', async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.news_sources (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        url text NOT NULL,
        feed_url text,
        source_type text NOT NULL,
        portal text NOT NULL,
        active boolean NOT NULL DEFAULT true,
        etag text,
        last_modified text,
        failure_count integer NOT NULL DEFAULT 0,
        last_fetched_at timestamptz,
        pagination_cursor text,
        pagination_complete boolean NOT NULL DEFAULT false,
        last_failure_at timestamptz,
        disabled_reason text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.news_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id uuid NOT NULL,
        external_id text NOT NULL,
        url text NOT NULL,
        url_hash text NOT NULL,
        title text NOT NULL,
        summary text,
        content text,
        published_at timestamptz,
        fetched_at timestamptz NOT NULL DEFAULT now(),
        classified boolean NOT NULL DEFAULT false,
        classification jsonb,
        UNIQUE(source_id,external_id)
      );
      CREATE TABLE IF NOT EXISTS public.radar_findings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        news_item_id uuid NOT NULL,
        title text NOT NULL,
        summary text,
        source_url text,
        review_status text NOT NULL DEFAULT 'review',
        auto_content_allowed boolean NOT NULL DEFAULT false
      );
    `)
    const migrations = path.resolve(process.cwd(), '../../packages/db/migrations')
    await pool.query(await readFile(path.join(migrations, '0052_news_item_versions.up.sql'), 'utf8'))
    await pool.query('TRUNCATE public.radar_findings, editorial.news_item_versions, public.news_items, public.news_sources')

    const listHtml = '<a href="/noticias/policia-mg-abre-concurso">Polícia Civil de Minas Gerais abre concurso público</a>'
    const articleHtml = '<html><head><meta property="article:published_time" content="2026-09-27T10:00:00-03:00"></head><body><h1>Polícia Civil de Minas Gerais abre concurso público</h1><div itemprop="articleBody"><p>A Polícia Civil de Minas Gerais publicou informações sobre novo concurso e cronograma do edital.</p><a href="/arquivos/edital.pdf">Edital</a></div></body></html>'
    const previousFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname === '/noticias') {
        return new Response(listHtml, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', etag: '"radar-local-fixture-v1"' } })
      }
      if (url.pathname === '/noticias/policia-mg-abre-concurso') {
        return new Response(articleHtml, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', etag: '"article-local-fixture-v1"' } })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const previousDeepseek = process.env.RADAR_DEEPSEEK_ENABLED
    process.env.RADAR_DEEPSEEK_ENABLED = 'false'
    const sourceId = '40000000-0000-4000-8000-000000000001'
    await pool.query(
      `INSERT INTO public.news_sources(id,name,url,feed_url,source_type,portal) VALUES($1,$2,$3,NULL,'html','pci-concursos')`,
      [sourceId, 'Local PCI fixture', 'https://www.pciconcursos.com.br/noticias'],
    )
    const queued = await store.enqueue(makeTaskRequest('news-radar.daily', { mode: 'full' }, { occurrenceKey: 'real-radar-local-fixture' }))
    const supervisor = new EditorialTaskSupervisor(store, {
      owner: 'real-radar-local-fixture',
      handlers: { 'news-radar.daily': createNewsRadarTaskHandler(pool) },
      pollIntervalMs: 60_000,
      heartbeatIntervalMs: 60_000,
      leaseMs: 10_000,
      shutdownGraceMs: 1_000,
      onError: error => { throw error },
    })

    try {
      await supervisor.start()
      await waitForRunStatus(pool, queued.runId, 'completed')
      const run = await pool.query<{ result: Record<string, unknown>; checkpoint: Record<string, unknown> }>(
        `SELECT result,checkpoint FROM editorial.task_runs WHERE id=$1::uuid`, [queued.runId],
      )
      const news = await pool.query<{ title: string; classified: boolean; url: string; content: string | null; details_http_status: number }>(
        `SELECT title,classified,url,content,details_http_status FROM public.news_items WHERE url='https://www.pciconcursos.com.br/noticias/policia-mg-abre-concurso'`,
      )
      const versions = await pool.query<{ parser_version: string; response_status: number; attachments: string[] }>(
        `SELECT parser_version,response_status,attachments FROM editorial.news_item_versions WHERE news_item_id=(SELECT id FROM public.news_items WHERE url='https://www.pciconcursos.com.br/noticias/policia-mg-abre-concurso')`,
      )
      const source = await pool.query<{ etag: string; last_fetched_at: Date }>(
        `SELECT etag,last_fetched_at FROM public.news_sources WHERE id=$1::uuid`, [sourceId],
      )
      const outbox = await pool.query<{ event_type: string; status: string }>(
        `SELECT event_type,status FROM editorial.task_outbox WHERE run_id=$1::uuid`, [queued.runId],
      )
      expect(run.rows[0]?.result).toMatchObject({ ok: true, fetched: 1, newItems: 1, detailsFetched: 1, detailsFailed: 0, classified: 0, classificationPending: 1, classificationDeferredReason: 'classifier_unavailable' })
      expect(run.rows[0]?.checkpoint).toMatchObject({ phase: 'collect', lastSourceId: sourceId, fetched: 1, newItems: 1, detailsFetched: 1 })
      expect(news.rows[0]).toMatchObject({
        title: 'Polícia Civil de Minas Gerais abre concurso público',
        classified: false,
        url: 'https://www.pciconcursos.com.br/noticias/policia-mg-abre-concurso',
        content: 'A Polícia Civil de Minas Gerais publicou informações sobre novo concurso e cronograma do edital. Edital',
        details_http_status: 200,
      })
      expect(versions.rows[0]).toMatchObject({ parser_version: 'article-details-v1', response_status: 200, attachments: ['https://www.pciconcursos.com.br/arquivos/edital.pdf'] })
      expect(source.rows[0]).toMatchObject({ etag: '"radar-local-fixture-v1"' })
      expect(source.rows[0]?.last_fetched_at).toBeInstanceOf(Date)
      expect(outbox.rows[0]).toMatchObject({ event_type: 'news-radar.completed', status: 'pending' })
    } finally {
      await supervisor.stop()
      globalThis.fetch = previousFetch
      if (previousDeepseek === undefined) delete process.env.RADAR_DEEPSEEK_ENABLED
      else process.env.RADAR_DEEPSEEK_ENABLED = previousDeepseek
    }
  })

  it('honors the global executor kill-switch and the single-leader lock', async () => {
    const secondPool = new Pool({ connectionString: testDatabaseUrl, max: 1 })
    const secondStore = new PostgresTaskRunStore(secondPool as unknown as TaskSqlPool)
    try {
      expect(await store.acquireLeadership()).toBe(true)
      expect(await secondStore.acquireLeadership()).toBe(false)
      await store.enqueue(makeTaskRequest('news-radar.daily', {}, { occurrenceKey: 'paused-job' }))
      await pool.query(`INSERT INTO public.runtime_controls(control_key,enabled) VALUES('kill-switch:global',true)`)
      await expect(store.claimNext(['heavy'], 'lane-test', 10_000)).resolves.toBeNull()
      await pool.query(`UPDATE public.runtime_controls SET enabled=false WHERE control_key='kill-switch:global'`)
      await expect(store.claimNext(['heavy'], 'lane-test', 10_000)).resolves.toMatchObject({ taskName: 'news-radar.daily' })
    } finally {
      await store.releaseLeadership()
      await secondStore.releaseLeadership()
      await secondPool.end()
    }
  })
})

async function waitForRunStatus(pool: Pool, runId: string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await pool.query<{ status: string }>(`SELECT status FROM editorial.task_runs WHERE id=$1::uuid`, [runId])
    if (result.rows[0]?.status === expected) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(`Task ${runId} did not reach ${expected}`)
}
