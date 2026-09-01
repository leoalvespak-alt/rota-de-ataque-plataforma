import { createHash } from 'node:crypto'
import type { Pool } from 'pg'

export type RateLimitResult = { count: number; retryAfterMs: number }

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function consumePostgresRateLimit(pool: Pick<Pool, 'query'>, input: {
  namespace: string
  identity: string
  path: string
  windowMs: number
}): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / input.windowMs)
  const key = `${input.namespace}:${hash(`${input.identity}:${input.path}:${bucket}`)}`
  const result = await pool.query<{ count: number; retry_after_ms: number }>(
    `INSERT INTO runtime_rate_limits(bucket_key, window_expires_at, count, updated_at)
     VALUES($1, now() + ($2::double precision * interval '1 millisecond'), 1, now())
     ON CONFLICT(bucket_key) DO UPDATE
       SET count = runtime_rate_limits.count + 1, updated_at = now()
     RETURNING count, GREATEST(1, CEIL(EXTRACT(epoch FROM (window_expires_at - now())) * 1000))::int AS retry_after_ms`,
    [key, input.windowMs],
  )
  return { count: Number(result.rows[0]?.count ?? 1), retryAfterMs: Number(result.rows[0]?.retry_after_ms ?? input.windowMs) }
}
