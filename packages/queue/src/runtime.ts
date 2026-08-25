import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { Queue, Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { EMBEDDING_DIM, logger, ReasonCodeSchema, type QueueName } from '@plataforma/shared'
import { startWorkerHeartbeat, type WorkerJob, type WorkerResult } from '@plataforma/shared/worker'

const flagName = (queue: string) => `WORKER_${queue.replaceAll('-', '_').toUpperCase()}_ENABLED`
const DEFAULT_EXPECTED_MIGRATION = '0035_reconcile_automation_runtime'

function reasonCodeFor(error: unknown) {
  const value = error as { reasonCode?: string; code?: string; message?: string } | null
  const parsed = ReasonCodeSchema.safeParse(value?.reasonCode)
  if (parsed.success) return parsed.data
  if (value?.code === '42703' || value?.code === '42P01' || /undefined_(column|table)/iu.test(value?.message ?? '')) return 'SQL_CONTRACT_ERROR'
  if (/queue|redis/iu.test(value?.message ?? '')) return 'QUEUE_UNAVAILABLE'
  return 'UNKNOWN'
}

function resultStateFor(result: WorkerResult) {
  const payload = result.event.payload as { reason?: string; status?: string } | null
  return result.reasonCode === 'NO_INPUT' || result.event.kind.includes('.skipped') || payload?.reason === 'no_input' || payload?.status === 'skipped' ? 'skipped' : 'succeeded'
}

function resultCounts(result: WorkerResult) {
  const payload = result.event.payload as Record<string, unknown> | null
  const numberFrom = (...keys: string[]) => keys.map((key) => payload?.[key]).find((value) => typeof value === 'number') as number | undefined
  return {
    input: result.inputCount ?? numberFrom('inputCount', 'itemsRead', 'seen', 'evaluated') ?? 0,
    output: result.outputCount ?? numberFrom('outputCount', 'itemsNew', 'published', 'updated', 'produced') ?? 0,
    rejected: result.rejectedCount ?? numberFrom('rejectedCount', 'itemsRejected', 'rejected') ?? 0,
  }
}

interface WorkerControlState {
  enabled: boolean
  requiredAccountRole?: 'collector' | 'actor'
  accountHealthy: boolean
}

async function readWorkerControl(queue: string, pool?: { query: <T>(sql: string, values: unknown[]) => Promise<{ rows: T[] }> }): Promise<WorkerControlState> {
  if (!pool) return { enabled: process.env[flagName(queue)] === 'true', accountHealthy: true }
  try {
    const result = await pool.query<{ enabled: boolean; required_account_role: 'collector' | 'actor' | null; account_healthy: boolean }>(`
      SELECT settings.enabled, settings.required_account_role,
        CASE WHEN settings.required_account_role IS NULL THEN true
          ELSE EXISTS(
            SELECT 1 FROM accounts
            WHERE role = settings.required_account_role AND status = 'HEALTHY'
          )
        END AS account_healthy
      FROM worker_settings settings
      WHERE settings.worker_name = $1
    `, [queue])
    // PostgreSQL é a fonte canônica do estado desejado. A flag só é fallback
    // para execução sem banco (testes locais/diagnóstico).
    const row = result.rows[0]
    return {
      enabled: row?.enabled ?? process.env[flagName(queue)] === 'true',
      requiredAccountRole: row?.required_account_role ?? undefined,
      accountHealthy: row?.account_healthy ?? false,
    }
  } catch {
    return { enabled: process.env[flagName(queue)] === 'true', accountHealthy: false }
  }
}

export function runWorker<T extends object = Record<string, unknown>>(queue: QueueName, processJob: (job: WorkerJob<T>) => Promise<WorkerResult>) {
  const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined
  let activeWorker: Worker | undefined
  let migrationState = { checkedAt: 0, current: false }

  const migrationsCurrent = async () => {
    if (!database?.pool) return process.env.MIGRATIONS_CURRENT === 'true'
    if (Date.now() - migrationState.checkedAt < 30_000) return migrationState.current
    const expected = process.env.EXPECTED_DB_MIGRATION ?? DEFAULT_EXPECTED_MIGRATION
    try {
      const result = await database.pool.query<{ applied: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1) AS applied',
        [expected],
      )
      migrationState = { checkedAt: Date.now(), current: result.rows[0]?.applied === true }
    } catch {
      migrationState = { checkedAt: Date.now(), current: false }
    }
    return migrationState.current
  }

  const boot = async () => {
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
    const metricsQueue = new Queue(queue, { connection })
    let jobsDone = 0, jobsFailed = 0, backlog = 0
    const latencies: number[] = []
    const worker = new Worker(queue, async (job: Job) => {
      const started = Date.now()
      const commandId = typeof job.data.commandId === 'string' ? job.data.commandId : null
      if (database?.pool) {
        try {
          await database.pool.query(
            `INSERT INTO worker_runs(worker_name,job_id,command_id,status,result_state,payload,trace_id)
             VALUES($1,$2,$3,'running','running',$4::jsonb,$5)
             ON CONFLICT(worker_name,job_id) DO UPDATE SET status='running',result_state='running',started_at=now(),finished_at=null,error_code=null,error_message=null,reason_code=null`,
            [queue, String(job.id), commandId, JSON.stringify(job.data), String(job.id)],
          )
        } catch { /* migration may not be applied during a rolling deploy */ }
      }
      if (database?.pool) {
        try { await database.pool.query("SET LOCAL app.actor_type = 'automation'", []) } catch {}
      }
      try {
        const control = await readWorkerControl(queue, database?.pool)
        const result: WorkerResult = job.data.synthetic === true && job.data.canaryOnly === true
          ? { ok: true, traceId: String(job.data.canaryTraceId ?? job.id ?? `${queue}:canary`), reasonCode: 'SUCCESS', event: { kind: 'synthetic-canary.completed', payload: { queue } } }
          : await processJob({
              id: job.id ?? `${queue}:unknown`,
              payload: job.data as T,
              attemptsMade: job.attemptsMade,
              preflight: {
                migrationsCurrent: await migrationsCurrent(),
                embeddingDimension: Number(process.env.EMBEDDING_DIM ?? EMBEDDING_DIM),
                tokenValid: process.env.META_TOKEN_VALID !== 'false',
                lockAvailable: true,
                budgetAvailable: process.env.DAILY_BUDGET_AVAILABLE !== 'false',
                accountStatus: database?.pool ? (control.accountHealthy ? 'HEALTHY' : 'STOPPED') : job.data.accountStatus ?? 'HEALTHY',
                accountRole: database?.pool ? control.requiredAccountRole : job.data.accountRole,
              },
            })
        jobsDone++
        const resultState = resultStateFor(result)
        const counts = resultCounts(result)
        const resultReasonCode = result.reasonCode ?? (resultState === 'skipped' ? 'NO_INPUT' : 'SUCCESS')
        if (database?.pool) {
          try { await database.pool.query('UPDATE worker_settings SET last_execution_at = now(), last_success_at = CASE WHEN $2 = \'succeeded\' THEN now() ELSE last_success_at END, last_error = NULL, last_error_at = NULL, items_processed = items_processed + $3, updated_at = now() WHERE worker_name = $1', [queue, resultState, counts.output]) } catch {}
          try {
            await database.pool.query(`UPDATE worker_runs SET status=$3,result_state=$4,reason_code=$5,input_count=$6,output_count=$7,rejected_count=$8,duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000,finished_at=now() WHERE worker_name=$1 AND job_id=$2`, [queue, String(job.id), resultState === 'succeeded' ? 'completed' : 'skipped', resultState, resultReasonCode, counts.input, counts.output, counts.rejected])
            if (commandId) await database.pool.query(`UPDATE worker_commands SET status='completed',completed_at=now() WHERE id=$1`, [commandId])
            if (resultState === 'succeeded') await database.pool.query(`UPDATE automation_incidents SET resolved_at=now() WHERE worker_name=$1 AND resolved_at IS NULL`, [queue])
          } catch {}
        }
        return result
      } catch (error) {
        jobsFailed++
        if (database?.pool) {
          const reasonCode = reasonCodeFor(error)
          try { await database.pool.query('UPDATE worker_settings SET last_error = $2, last_error_at = now(), updated_at = now() WHERE worker_name = $1', [queue, String(error).slice(0, 500)]) } catch {}
          try {
            const run = await database.pool.query<{ id: string; last_success_at: string | null }>(`UPDATE worker_runs SET status='failed',result_state='failed',reason_code=$3,error_code=$3,error_message=$4,duration_ms=EXTRACT(EPOCH FROM (now()-started_at))*1000,finished_at=now() WHERE worker_name=$1 AND job_id=$2 RETURNING id`, [queue, String(job.id), reasonCode, String(error).slice(0, 500)])
            await database.pool.query(`INSERT INTO automation_incidents(worker_name,run_id,reason_code,title_pt,explanation_pt,impact_pt,next_action_pt,runbook_href,trace_id,retryable,last_success_at,details)
              SELECT $1, $2, catalog.code, catalog.title_pt, catalog.explanation_pt, 'A fila pode acumular trabalho e o resultado esperado não foi produzido.', catalog.next_action_pt, catalog.runbook_href, $3, catalog.retryable, settings.last_success_at, jsonb_build_object('error', $4::text)
              FROM automation_reason_codes catalog CROSS JOIN worker_settings settings
              WHERE catalog.code=$5 AND settings.worker_name=$1`, [queue, run.rows[0]?.id ?? null, String(job.id), String(error).slice(0, 500), reasonCode])
            if (commandId) await database.pool.query(`UPDATE worker_commands SET status='failed',error_code=$2,completed_at=now() WHERE id=$1`, [commandId, reasonCode])
          } catch {}
        }
        throw error
      } finally { latencies.push(Date.now() - started); if (latencies.length > 500) latencies.shift() }
    }, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1) })
    const sortedLatency = () => { const sorted = [...latencies].sort((a,b)=>a-b); return sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)] ?? 0 }
    activeWorker = worker
    // Reserve o heartbeat canônico antes do primeiro await. Alguns workers
    // legados ainda tentam registrar métricas próprias logo após runWorker()
    // retornar; sem esta ordem, eles vencem a deduplicação por worker/instância
    // e publicam o estado obsoleto `disabled` em vez de `paused`.
    let desiredEnabled = false
    const stopHeartbeat = database ? startWorkerHeartbeat(queue, createPostgresHeartbeatStore(database.pool), () => ({ jobsDone, jobsFailed, backlog, p95LatencyMs: sortedLatency(), state: desiredEnabled && worker.isRunning() ? 'running' : 'paused' })) : async () => undefined
    desiredEnabled = (await readWorkerControl(queue, database?.pool)).enabled
    if (!desiredEnabled) await worker.pause()
    const reconcile = async () => {
      const nextEnabled = (await readWorkerControl(queue, database?.pool)).enabled
      if (nextEnabled === desiredEnabled) return
      desiredEnabled = nextEnabled
      if (nextEnabled) {
        await worker.resume()
        logger.info({ worker: queue }, 'worker resumed from desired state')
      } else {
        await worker.pause()
        logger.info({ worker: queue }, 'worker paused from desired state')
      }
    }
    const controlTimer = setInterval(() => void reconcile().catch((error) => logger.error({ worker: queue, err: error }, 'worker desired-state reconciliation failed')), 5_000)
    worker.on('completed', (job) => logger.info({ worker: queue, job_id: job.id }, 'job complete'))
    worker.on('failed', (job, error) => logger.error({ worker: queue, job_id: job?.id, err: error }, 'job failed'))
    const backlogTimer = setInterval(
      () => void metricsQueue
        .getJobCounts('waiting', 'delayed', 'active')
        .then((counts) => {
          backlog = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0)
        })
        .catch(() => undefined),
      15_000,
    )
    const shutdown = async () => { clearInterval(backlogTimer); clearInterval(controlTimer); await stopHeartbeat(); await worker.close(); await metricsQueue.close(); await connection.quit(); await database?.pool.end() }
    process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown())
    return worker
  }

  void boot()
  return { isRunning: () => activeWorker?.isRunning() ?? false }
}
