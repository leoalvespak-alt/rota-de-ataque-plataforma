import { Queue, type ConnectionOptions } from 'bullmq'

const connection: ConnectionOptions = { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) }
export const EDITORIAL_QUEUE_NAMES = ['editorial-plan', 'editorial-brief', 'editorial-copy', 'editorial-review', 'editorial-similarity', 'editorial-rewrite', 'editorial-template', 'editorial-visual', 'editorial-render', 'editorial-finalize'] as const
export type EditorialQueueName = (typeof EDITORIAL_QUEUE_NAMES)[number]
export type EditorialJobData = { generationJobId: string; planId?: string; planItemId?: string; contentItemId?: string; payload?: Record<string, unknown> }
export function createEditorialQueue(name: EditorialQueueName, options: ConnectionOptions = connection) { return new Queue<EditorialJobData>(name, { connection: options, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { count: 500 }, removeOnFail: { count: 100 } } }) }
const queues = new Map<EditorialQueueName, Queue<EditorialJobData>>()
export function getEditorialQueue(name: EditorialQueueName) {
  const existing = queues.get(name)
  if (existing) return existing
  const queue = createEditorialQueue(name)
  queues.set(name, queue)
  return queue
}
