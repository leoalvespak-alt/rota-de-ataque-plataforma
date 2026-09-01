import { createDatabase } from '@plataforma/db'
import { EMBEDDING_DIM, logger, type QueueName } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult } from '@plataforma/shared/worker'

const DEFAULT_EXPECTED_MIGRATION = '0040_prospector_expurgo_legacy'

export function runWorker<T extends object = Record<string, unknown>>(
  workerName: QueueName,
  processJob: (job: WorkerJob<T>) => Promise<WorkerResult>,
) {
  const payload = process.env.WORKER_PAYLOAD ? JSON.parse(process.env.WORKER_PAYLOAD) as T : {} as T
  const database = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined
  const job: WorkerJob<T> = {
    id: process.env.WORKER_JOB_ID ?? `${workerName}:${Date.now()}`,
    payload,
    attemptsMade: Number(process.env.WORKER_ATTEMPTS ?? 0),
    preflight: {
      migrationsCurrent: process.env.MIGRATIONS_CURRENT !== 'false',
      embeddingDimension: Number(process.env.EMBEDDING_DIM ?? EMBEDDING_DIM),
      tokenValid: process.env.META_TOKEN_VALID !== 'false',
      lockAvailable: true,
      budgetAvailable: process.env.DAILY_BUDGET_AVAILABLE !== 'false',
      accountStatus: 'HEALTHY',
      accountRole: workerName === 'news-radar' ? 'collector' : undefined,
    },
  }

  const execute = async () => {
    if (database?.pool) {
      const expected = process.env.EXPECTED_DB_MIGRATION ?? DEFAULT_EXPECTED_MIGRATION
      const current = await database.pool.query(
        'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1) AS applied',
        [expected],
      )
      job.preflight.migrationsCurrent = current.rows[0]?.applied === true
    }
    const result = await processJob(job)
    logger.info({ worker: workerName, job_id: job.id, result: result.event }, 'worker run complete')
    await database?.pool.end()
    return result
  }

  void execute().catch(async (error) => {
    logger.error({ worker: workerName, err: error }, 'worker run failed')
    await database?.pool.end()
    process.exitCode = 1
  })

  return { isRunning: () => false }
}

export const runWorkerOnce = runWorker
