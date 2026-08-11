import { createDatabase, createPostgresHeartbeatStore } from '@plataforma/db'
import { Queue, Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { EMBEDDING_DIM, logger, type QueueName } from '@plataforma/shared'
import { startWorkerHeartbeat, type WorkerJob, type WorkerResult } from '@plataforma/shared/worker'

const flagName = (queue: string) => `WORKER_${queue.replaceAll('-', '_').toUpperCase()}_ENABLED`
export function runWorker<T extends object = Record<string, unknown>>(queue: QueueName, processJob: (job: WorkerJob<T>) => Promise<WorkerResult>) {
  if (process.env[flagName(queue)] !== 'true') { logger.info({ worker: queue }, 'worker disabled by feature flag'); return }
  const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const metricsQueue = new Queue(queue, { connection })
  let jobsDone = 0, jobsFailed = 0, backlog = 0
  const latencies: number[] = []
  const worker = new Worker(queue, async (job: Job) => { const started = Date.now(); try { if (job.data.synthetic === true && job.data.canaryOnly === true) { jobsDone++; return { traceId: job.data.canaryTraceId, reasonCode: 'SUCCESS', event: { kind: 'synthetic-canary.completed', payload: { queue } } } } const result = await processJob({ id: job.id ?? `${queue}:unknown`, payload: job.data as T, preflight: job.data.preflight ?? { migrationsCurrent: process.env.MIGRATIONS_CURRENT === 'true', embeddingDimension: Number(process.env.EMBEDDING_DIM ?? EMBEDDING_DIM), tokenValid: process.env.META_TOKEN_VALID !== 'false', lockAvailable: true, budgetAvailable: process.env.DAILY_BUDGET_AVAILABLE !== 'false', accountStatus: job.data.accountStatus ?? 'HEALTHY', accountRole: job.data.accountRole } }); jobsDone++; return result } catch (error) { jobsFailed++; throw error } finally { latencies.push(Date.now() - started); if (latencies.length > 500) latencies.shift() } }, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1) })
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
  const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined
  const sortedLatency = () => { const sorted = [...latencies].sort((a,b)=>a-b); return sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)] ?? 0 }
  const stopHeartbeat = database ? startWorkerHeartbeat(queue, createPostgresHeartbeatStore(database.pool), () => ({ jobsDone, jobsFailed, backlog, p95LatencyMs: sortedLatency(), state: worker.isRunning() ? 'running' : 'stopped' })) : async () => undefined
  const shutdown = async () => { clearInterval(backlogTimer); await stopHeartbeat(); await worker.close(); await metricsQueue.close(); await connection.quit(); await database?.pool.end() }
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown())
  return worker
}
