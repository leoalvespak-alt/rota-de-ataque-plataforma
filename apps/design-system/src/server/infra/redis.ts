import Redis from 'ioredis'
import type { ConnectionOptions } from 'bullmq'

const redisUrl = process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379}`

let instance: Redis | undefined
export function getRedis(): Redis {
  instance ??= new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
  return instance
}

export function getBullMQConnection(): ConnectionOptions {
  const url = new URL(redisUrl)
  return { host: url.hostname, port: Number(url.port || 6379) }
}
