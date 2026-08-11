import { collectInstagramComments, launchPersistentContext, withAccountMutex } from '@plataforma/browser'
import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { runWorker } from '@plataforma/queue/runtime'
import { startWorkerHeartbeat } from '@plataforma/shared/worker'
import { Redis } from 'ioredis'
import path from 'node:path'
import { createExtractionProcessor, spec, type ExtractionPayload, type ExtractionRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required')
const { pool } = createDatabase(databaseUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const registry = createQueueRegistry(redisUrl)

const repository: ExtractionRepository = {
  async health(accountId) {
    const result = await pool.query<{ successRate: string | null; checkpoints: number; acknowledged: boolean }>(`SELECT ah.recent_success_rate AS "successRate",ah.checkpoints_count AS checkpoints,COALESCE(a.acknowledged_at IS NOT NULL,false) AS acknowledged FROM account_health ah LEFT JOIN alerts a ON a.kind='extraction_circuit_breaker' AND a.fingerprint='extraction_circuit_breaker:' || $1 AND a.acknowledged_at IS NOT NULL WHERE ah.account_id=$1 ORDER BY ah.captured_at DESC LIMIT 1`, [accountId])
    const row = result.rows[0]
    return { successRate: Number(row?.successRate ?? 1), checkpoints: row?.checkpoints ?? 0, acknowledged: row?.acknowledged ?? false }
  },
  async startRun(payload) {
    const result = await pool.query<{ id: string }>(`INSERT INTO crawl_runs(account_id,scope_type,scope_id,source,status) VALUES($1,'post',$2,'scrape','running') RETURNING id`, [payload.accountId, payload.postId])
    return result.rows[0]!.id
  },
  async saveComment(payload, comment) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const inserted = await client.query<{ id: string }>(`INSERT INTO comments(post_id,comment_external_id,username,text,commented_at,profile_snippet,source) VALUES($1,$2,$3,$4,$5,$6,'scrape') ON CONFLICT(post_id,comment_external_id) DO NOTHING RETURNING id`, [payload.postId, comment.externalId, comment.username, comment.text, comment.commentedAt ?? null, JSON.stringify(comment.profileSnippet)])
      const commentId = inserted.rows[0]?.id ?? (await client.query<{ id: string }>('SELECT id FROM comments WHERE post_id=$1 AND comment_external_id=$2', [payload.postId, comment.externalId])).rows[0]!.id
      if (!inserted.rowCount) { await client.query('COMMIT'); return { commentId, leadId: '', inserted: false } }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [comment.username.toLowerCase()])
      let lead = await client.query<{ id: string }>('SELECT id FROM leads WHERE lower(username_current)=lower($1) ORDER BY last_seen_at DESC LIMIT 1', [comment.username])
      if (!lead.rows[0]) lead = await client.query<{ id: string }>('INSERT INTO leads(username_current,profile_url) VALUES($1,$2) RETURNING id', [comment.username, `https://www.instagram.com/${comment.username}/`])
      const leadId = lead.rows[0]!.id
      await client.query('UPDATE leads SET last_seen_at=now(),username_current=$2 WHERE id=$1', [leadId, comment.username])
      await client.query(`INSERT INTO lead_profile(lead_id,is_verified,has_profile_pic,fetched_at) VALUES($1,$2,$3,now()) ON CONFLICT(lead_id) DO UPDATE SET is_verified=COALESCE(EXCLUDED.is_verified,lead_profile.is_verified),has_profile_pic=COALESCE(EXCLUDED.has_profile_pic,lead_profile.has_profile_pic),fetched_at=now()`, [leadId, comment.profileSnippet.verified ?? null, Boolean(comment.profileSnippet.avatar)])
      await client.query(`INSERT INTO lead_sources(lead_id,campaign_id,competitor_id,post_id,comment_id,source_kind) VALUES($1,$2,$3,$4,$5,'comment') ON CONFLICT(lead_id,comment_id) DO NOTHING`, [leadId, payload.campaignId, payload.competitorId, payload.postId, commentId])
      await client.query('COMMIT')
      return { commentId, leadId, inserted: true }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  },
  async finishRun(runId, result) {
    await pool.query(`UPDATE crawl_runs SET finished_at=now(),status=$2,items_seen=$3,items_new=$4,extraction_coverage=$5 WHERE id=$1`, [runId, result.status, result.itemsSeen, result.itemsNew, result.coverage])
  },
  async pauseAccount(accountId, hours) {
    await pool.query(`UPDATE accounts SET status='COOLDOWN',cooldown_until=now()+($2 || ' hours')::interval WHERE id=$1`, [accountId, hours])
  },
  async alert(kind, severity, payload) {
    await pool.query(`INSERT INTO alerts(kind,severity,payload,fingerprint) VALUES($1,$2,$3,$4)`, [kind, severity, JSON.stringify(payload), `${kind}:${payload.accountId ?? payload.postId ?? 'global'}`])
  },
}

const queue = { classification: (commentId: string, payload: Record<string, unknown>) => enqueueOnce(registry.queues.classification, 'classification', ['comment', payload.scope as string, commentId, 'classification'], payload).then(() => undefined) }
const extractor = {
  async extract(payload: ExtractionPayload) {
    return withAccountMutex(redis, payload.accountId, async () => {
      const context = await launchPersistentContext(path.join(process.env.CHROMIUM_PROFILES_DIR ?? '/data/chromium_profiles', payload.accountId))
      try { return await collectInstagramComments(await context.newPage(), payload.postUrl) } finally { await context.close() }
    })
  },
}
const worker = runWorker(spec.queue, createExtractionProcessor(repository, queue, extractor))
const stopHeartbeat = startWorkerHeartbeat(spec.queue, createPostgresHeartbeatStore(pool), () => ({ jobsDone: 0, jobsFailed: 0, backlog: 0, p95LatencyMs: 0, state: worker?.isRunning() ? 'running' : 'disabled' }))
process.once('SIGTERM', () => void stopHeartbeat().finally(() => pool.end()).finally(() => redis.quit()).finally(() => registry.connection.quit()))
