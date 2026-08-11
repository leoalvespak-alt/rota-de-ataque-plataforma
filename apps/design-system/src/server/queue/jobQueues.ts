import { Queue, Worker, type Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'

const defaultConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}

export type RenderJobData = {
  creativeId: string
  templateId: string
  elements: Record<string, unknown>
  dark: boolean
  format: 'png' | 'jpeg' | 'webp' | 'pdf'
  scale: number
}

export type ExportJobData = {
  creativeId: string
  format: string
  options: Record<string, unknown>
}

export type ImageGenJobData = {
  prompt: string
  provider: string
  width: number
  height: number
}

export type TextGenJobData = {
  prompt: string
  provider: string
  systemPrompt?: string
  maxTokens?: number
}

export function createRenderQueue(connection = defaultConnection) {
  const queue = new Queue<RenderJobData>('render', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })

  return queue
}

export function createExportQueue(connection = defaultConnection) {
  return new Queue<ExportJobData>('export', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 },
      removeOnComplete: { count: 50 },
    },
  })
}

export function createImageGenQueue(connection = defaultConnection) {
  return new Queue<ImageGenJobData>('image-gen', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 200 },
    },
  })
}

export function createTextGenQueue(connection = defaultConnection) {
  return new Queue<TextGenJobData>('text-gen', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 200 },
    },
  })
}

export function createRenderWorker(
  processor: (job: Job<RenderJobData>) => Promise<void>,
  connection = defaultConnection,
) {
  return new Worker<RenderJobData>('render', processor, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  })
}
