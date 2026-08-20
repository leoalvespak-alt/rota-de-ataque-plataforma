import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { Queue, Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { EMBEDDING_DIM, logger, type QueueName } from '@plataforma/shared'
import { startWorkerHeartbeat, type WorkerJob, type WorkerResult } from '@plataforma/shared/worker'

const flagName = (queue: string) => `WORKER_${queue.replaceAll('-', '_').toUpperCase()}_ENABLED`

async function checkWorkerEnabled(queue: string, pool?: { query: (sql: string, values: unknown[]) => Promise<{ rows: { enabled: boolean }[] }> }): Promise<boolean> {
  if (!pool) return process.env[flagName(queue)] === 'true'
  try {
    const result = await pool.query('SELECT enabled FROM worker_settings WHERE worker_name = $1', [queue])
    // PostgreSQL é a fonte canônica do estado desejado. A flag só é fallback
    // para execução sem banco (testes locais/diagnóstico).
    return result.rows[0]?.enabled ?? process.env[flagName(queue)] === 'true'
  } catch { return process.env[flagName(queue)] === 'true' }
}

export function runWorker<T extends object = Record<string, unknown>>(queue: QueueName, processJob: (job: WorkerJob<T>) => Promise<WorkerResult>) {
  const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined
  let activeWorker: Worker | undefined

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
            `INSERT INTO worker_runs(worker_name,job_id,command_id,status,payload,trace_id)
             VALUES($1,$2,$3,'running',$4::jsonb,$5)
             ON CONFLICT(worker_name,job_id) DO UPDATE SET status='running',started_at=now(),finished_at=null,error_code=null,error_message=null`,
            [queue, String(job.id), commandId, JSON.stringify(job.data), String(job.id)],
          )
        } catch { /* migration may not be applied during a rolling deploy */ }
      }
      if (database?.pool) {
        try { await database.pool.query("SET LOCAL app.actor_type = 'automation'", []) } catch {}
      }
      try {
        if (job.data.synthetic === true && job.data.canaryOnly === true) { jobsDone++; return { traceId: job.data.canaryTraceId, reasonCode: 'SUCCESS', event: { kind: 'synthetic-canary.completed', payload: { queue } } } }
        const result = await processJob({ id: job.id ?? `${queue}:unknown`, payload: job.data as T, attemptsMade: job.attemptsMade, preflight: job.data.preflight ?? { migrationsCurrent: process.env.MIGRATIONS_CURRENT === 'true', embeddingDimension: Number(process.env.EMBEDDING_DIM ?? EMBEDDING_DIM), tokenValid: process.env.META_TOKEN_VALID !== 'false', lockAvailable: true, budgetAvailable: process.env.DAILY_BUDGET_AVAILABLE !== 'false', accountStatus: job.data.accountStatus ?? 'HEALTHY', accountRole: job.data.accountRole } })
        jobsDone++
        if (database?.pool) {
          try { await database.pool.query('UPDATE worker_settings SET last_execution_at = now(), items_processed = items_processed + 1, updated_at = now() WHERE worker_name = $1', [queue]) } catch {}
          try {
            await database.pool.query(`UPDATE worker_runs SET status='completed',finished_at=now() WHERE worker_name=$1 AND job_id=$2`, [queue, String(job.id)])
            if (commandId) await database.pool.query(`UPDATE worker_commands SET status='completed',completed_at=now() WHERE id=$1`, [commandId])
          } catch {}
        }
        return result
      } catch (error) {
        jobsFailed++
        if (database?.pool) {
          try { await database.pool.query('UPDATE worker_settings SET last_error = $2, last_error_at = now(), updated_at = now() WHERE worker_name = $1', [queue, String(error)]) } catch {}
          try {
            await database.pool.query(`UPDATE worker_runs SET status='failed',error_code='job_failed',error_message=$3,finished_at=now() WHERE worker_name=$1 AND job_id=$2`, [queue, String(job.id), String(error).slice(0, 500)])
            if (commandId) await database.pool.query(`UPDATE worker_commands SET status='failed',error_code='job_failed',completed_at=now() WHERE id=$1`, [commandId])
          } catch {}
        }
        throw error
      } finally { latencies.push(Date.now() - started); if (latencies.length > 500) latencies.shift() }
    }, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1) })
    activeWorker = worker
    let desiredEnabled = await checkWorkerEnabled(queue, database?.pool)
    if (!desiredEnabled) await worker.pause()
    const reconcile = async () => {
      const nextEnabled = await checkWorkerEnabled(queue, database?.pool)
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
    const sortedLatency = () => { const sorted = [...latencies].sort((a,b)=>a-b); return sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)] ?? 0 }
    const stopHeartbeat = database ? startWorkerHeartbeat(queue, createPostgresHeartbeatStore(database.pool), () => ({ jobsDone, jobsFailed, backlog, p95LatencyMs: sortedLatency(), state: desiredEnabled && worker.isRunning() ? 'running' : 'paused' })) : async () => undefined
    const shutdown = async () => { clearInterval(backlogTimer); clearInterval(controlTimer); await stopHeartbeat(); await worker.close(); await metricsQueue.close(); await connection.quit(); await database?.pool.end() }
    process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown())
    return worker
  }

  void boot()
  return { isRunning: () => activeWorker?.isRunning() ?? false }
}
