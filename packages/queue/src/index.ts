import { Queue, QueueEvents, type JobsOptions, type RepeatOptions } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES, deterministicJobId, toErrorEvent, type QueueName } from '@plataforma/shared'
export const variantJobId = (contentItemId: string, channel: string) => deterministicJobId('content-variant', [contentItemId, channel])
export const publishVariantJobId = (variantId: string) => deterministicJobId('content-publish', [variantId])
export const redditWatchJobId = (watchId: string, cursor = 'latest') => deterministicJobId('reddit-intelligence', [watchId, cursor])

export const retryPolicy: Record<QueueName, JobsOptions> = Object.fromEntries(QUEUE_NAMES.map((name) => [name, { attempts: name === 'engagement' || name === 'publisher' ? 3 : 5, backoff: { type: 'exponential', delay: name === 'meta-sync' ? 30_000 : 5_000 }, removeOnComplete: 1_000, removeOnFail: false }])) as Record<QueueName, JobsOptions>
export function createQueueRegistry(redisUrl: string) { const connection = new Redis(redisUrl, { maxRetriesPerRequest: null }); return { connection, queues: Object.fromEntries(QUEUE_NAMES.map((name) => [name, new Queue(name, { connection, defaultJobOptions: retryPolicy[name] })])) as Record<QueueName, Queue> } }

// Primary scheduler config per manageable worker — shared with set_schedule API so IDs stay consistent
export const MANAGED_SCHEDULER_CONFIG: Partial<Record<QueueName, {
  primaryId: string
  defaultOpts: RepeatOptions
  data: Record<string, unknown>
}>> = {
  'news-radar': { primaryId: 'news-radar-rss-15m-v1', defaultOpts: { every: 900_000 }, data: { mode: 'incremental' } },
  'competitive-intel': { primaryId: 'competitive-intel-daily-v1', defaultOpts: { pattern: '0 1 * * *' }, data: { windowDays: 30 } },
  'data-quality': { primaryId: 'data-quality-daily-v1', defaultOpts: { pattern: '0 4 * * *' }, data: { refreshViews: true } },
  'community-map': { primaryId: 'community-map-weekly-v1', defaultOpts: { pattern: '0 5 * * 1' }, data: {} },
  'reddit-intelligence': { primaryId: 'reddit-intelligence-15m-v1', defaultOpts: { every: 900_000 }, data: {} },
  'email-flow-engine': { primaryId: 'email-flow-engine-5m-v1', defaultOpts: { every: 300_000 }, data: { limit: 100 } },
  'adaptive-crawler': { primaryId: 'adaptive-crawler-15m-v1', defaultOpts: { every: 900_000 }, data: {} },
  'publisher': { primaryId: 'publisher-due-1m-v1', defaultOpts: { every: 60_000 }, data: {} },
  'threads-publisher': { primaryId: 'threads-publisher-due-1m-v1', defaultOpts: { every: 60_000 }, data: {} },
}

export function parseCadence(cadence: string): RepeatOptions {
  return cadence.startsWith('every:') ? { every: Number(cadence.slice(6)) } : { pattern: cadence }
}

export async function installPlatformSchedulers(
  registry: ReturnType<typeof createQueueRegistry>,
  cadenceOverrides?: Record<string, string>,
) {
  const managedTasks = Object.entries(MANAGED_SCHEDULER_CONFIG).map(([workerName, config]) => {
    if (!config) return Promise.resolve()
    const queue = registry.queues[workerName as QueueName]
    if (!queue) return Promise.resolve()
    const override = cadenceOverrides?.[workerName]
    const opts = override ? parseCadence(override) : config.defaultOpts
    return queue.upsertJobScheduler(config.primaryId, opts, { name: workerName, data: config.data })
  })

  await Promise.all([
    // Fixed operational schedulers — not configurable via UI
    registry.queues.alerts.upsertJobScheduler('dead-man-v1', { every: 30_000 }, { name: 'dead-man', data: { kind: 'dead-man' } }),
    registry.queues.alerts.upsertJobScheduler('canary-daily-v1', { pattern: '0 3 * * *' }, { name: 'canary', data: { kind: 'canary' } }),
    registry.queues['source-roi'].upsertJobScheduler('source-roi-7d-daily-v1', { pattern: '15 2 * * *' }, { name: 'source-roi-7d', data: { windowDays: 7, apply: false } }),
    registry.queues['source-roi'].upsertJobScheduler('source-roi-30d-daily-v1', { pattern: '30 2 * * *' }, { name: 'source-roi-30d', data: { windowDays: 30, apply: false } }),
    // news-radar full scan stays fixed; incremental cadence is managed above
    registry.queues['news-radar'].upsertJobScheduler('news-radar-full-12h-v1', { pattern: '0 */12 * * *' }, { name: 'news-radar-full', data: { mode: 'full' } }),
    // competitive-intel weekly scan stays fixed; daily cadence is managed above
    registry.queues['competitive-intel'].upsertJobScheduler('competitive-intel-weekly-v1', { pattern: '0 6 * * 1' }, { name: 'competitive-intel-weekly', data: { windowDays: 7 } }),
    ...managedTasks,
  ])
}
export async function enqueueOnce(queue: Queue<any, any, string>, queueName: QueueName, parts: Array<string | number>, payload: unknown, options: JobsOptions = {}) { const jobId = deterministicJobId(queueName, parts); const existing = await queue.getJob(jobId); return existing ?? queue.add(queueName, payload, { ...options, jobId }) }
export async function observeFailures(queueName: QueueName, redisUrl: string, persist: (row: { queueName: string; jobId: string; payload: unknown; error: string; event: unknown }) => Promise<void>) { const connection = new Redis(redisUrl, { maxRetriesPerRequest: null }); const events = new QueueEvents(queueName, { connection }); events.on('failed', async ({ jobId, failedReason }) => { const queue = new Queue(queueName, { connection }); const job = await queue.getJob(jobId); const event = toErrorEvent(new Error(failedReason), { source: 'bullmq', worker: queueName, job_id: jobId, trace_id: crypto.randomUUID(), severity: 'error' }); await persist({ queueName, jobId, payload: job?.data, error: failedReason, event }); await queue.add(`${queueName}.dlq`, { originalJobId: jobId, payload: job?.data, event }, { jobId: `dlq:${jobId}` }) }); return events }
