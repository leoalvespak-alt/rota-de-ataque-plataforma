import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { logger } from '@plataforma/shared'
import { makeTaskRequest } from '@plataforma/task-runtime'
import { createNewsRadarTaskHandler } from './runtime.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)
const handleNewsRadar = createNewsRadarTaskHandler(pool)

runWorker('news-radar', async (job) => {
  const request = makeTaskRequest('news-radar.daily', job.payload, { occurrenceKey: job.id })
  const execution = await handleNewsRadar(request, {
    runId: job.id,
    attempt: job.attemptsMade ?? 0,
    checkpoint: null,
    signal: new AbortController().signal,
    saveCheckpoint: async (checkpoint) => logger.info({ job_id: job.id, checkpoint }, 'news-radar checkpoint'),
  })
  return {
    ok: true,
    traceId: job.id,
    event: { kind: 'news-radar.completed', payload: execution.result },
  }
})
