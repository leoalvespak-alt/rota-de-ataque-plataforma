import { Queue, QueueEvents, type JobsOptions } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES, deterministicJobId, toErrorEvent, type QueueName } from '@plataforma/shared'
export const variantJobId = (contentItemId: string, channel: string) => deterministicJobId('content-variant', [contentItemId, channel])
export const publishVariantJobId = (variantId: string) => deterministicJobId('content-publish', [variantId])
export const redditWatchJobId = (watchId: string, cursor = 'latest') => deterministicJobId('reddit-intelligence', [watchId, cursor])

export const retryPolicy: Record<QueueName, JobsOptions> = Object.fromEntries(QUEUE_NAMES.map((name) => [name, { attempts: name === 'engagement' || name === 'publisher' ? 3 : 5, backoff: { type: 'exponential', delay: name === 'meta-sync' ? 30_000 : 5_000 }, removeOnComplete: 1_000, removeOnFail: false }])) as Record<QueueName, JobsOptions>
export function createQueueRegistry(redisUrl: string) { const connection = new Redis(redisUrl, { maxRetriesPerRequest: null }); return { connection, queues: Object.fromEntries(QUEUE_NAMES.map((name) => [name, new Queue(name, { connection, defaultJobOptions: retryPolicy[name] })])) as Record<QueueName, Queue> } }
export async function installPlatformSchedulers(registry: ReturnType<typeof createQueueRegistry>) {
  await Promise.all([
    registry.queues.alerts.upsertJobScheduler('dead-man-v1', { every: 30_000 }, { name: 'dead-man', data: { kind: 'dead-man' } }),
    registry.queues.alerts.upsertJobScheduler('canary-daily-v1', { pattern: '0 3 * * *' }, { name: 'canary', data: { kind: 'canary' } }),
    registry.queues['source-roi'].upsertJobScheduler('source-roi-7d-daily-v1', { pattern: '15 2 * * *' }, { name: 'source-roi-7d', data: { windowDays: 7, apply: false } }),
    registry.queues['source-roi'].upsertJobScheduler('source-roi-30d-daily-v1', { pattern: '30 2 * * *' }, { name: 'source-roi-30d', data: { windowDays: 30, apply: false } }),
    registry.queues['adaptive-crawler'].upsertJobScheduler('adaptive-crawler-15m-v1', { every: 900_000 }, { name: 'adaptive-crawler', data: {} }),
    registry.queues['data-quality'].upsertJobScheduler('data-quality-daily-v1', { pattern: '0 4 * * *' }, { name: 'data-quality', data: { refreshViews: true } }),
    registry.queues['community-map'].upsertJobScheduler('community-map-weekly-v1', { pattern: '0 5 * * 1' }, { name: 'community-map', data: {} }),
    registry.queues['competitive-intel'].upsertJobScheduler('competitive-intel-daily-v1', { pattern: '0 1 * * *' }, { name: 'competitive-intel', data: { windowDays: 30 } }),
    registry.queues['reddit-intelligence'].upsertJobScheduler('reddit-intelligence-15m-v1', { every: 900_000 }, { name: 'reddit-intelligence', data: {} }),
    registry.queues['email-flow-engine'].upsertJobScheduler('email-flow-engine-5m-v1', { every: 300_000 }, { name: 'email-flow-engine', data: { limit: 100 } }),
  ])
}
export async function enqueueOnce(queue: Queue<any, any, string>, queueName: QueueName, parts: Array<string | number>, payload: unknown, options: JobsOptions = {}) { const jobId = deterministicJobId(queueName, parts); const existing = await queue.getJob(jobId); return existing ?? queue.add(queueName, payload, { ...options, jobId }) }
export async function observeFailures(queueName: QueueName, redisUrl: string, persist: (row: { queueName: string; jobId: string; payload: unknown; error: string; event: unknown }) => Promise<void>) { const connection = new Redis(redisUrl, { maxRetriesPerRequest: null }); const events = new QueueEvents(queueName, { connection }); events.on('failed', async ({ jobId, failedReason }) => { const queue = new Queue(queueName, { connection }); const job = await queue.getJob(jobId); const event = toErrorEvent(new Error(failedReason), { source: 'bullmq', worker: queueName, job_id: jobId, trace_id: crypto.randomUUID(), severity: 'error' }); await persist({ queueName, jobId, payload: job?.data, error: failedReason, event }); await queue.add(`${queueName}.dlq`, { originalJobId: jobId, payload: job?.data, event }, { jobId: `dlq:${jobId}` }) }); return events }
