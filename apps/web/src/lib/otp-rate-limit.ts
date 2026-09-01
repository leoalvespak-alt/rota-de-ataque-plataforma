import { createHash } from 'node:crypto'

export const OTP_RATE_LIMIT_POLICY = {
  windowMs: 15 * 60_000,
  maxRequests: 5,
  cooldownMs: 60_000,
  unavailableRetryAfterSeconds: 60,
} as const

export type OtpRateLimitScope = 'cooldown' | 'ip' | 'identifier'
export type OtpRateLimitDecision =
  | { allowed: true }
  | { allowed: false; scope: OtpRateLimitScope; retryAfterSeconds: number }

export interface RateLimitDatabase {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}

function keyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeOtpIdentifier(email: string): string {
  return email.trim().toLocaleLowerCase('en-US')
}

export function normalizeClientAddress(value: string | null): string {
  const first = value?.split(',')[0]?.trim() ?? ''
  return first.length > 0 && first.length <= 128 ? first : 'unknown'
}

export function otpRateLimitKeys(email: string, ip: string): [string, string, string] {
  const identifierHash = keyHash(`identifier:${normalizeOtpIdentifier(email)}`)
  const ipHash = keyHash(`ip:${ip}`)
  const bucket = Math.floor(Date.now() / OTP_RATE_LIMIT_POLICY.windowMs)
  return [
    `otp:v2:cooldown:${identifierHash}`,
    `otp:v2:window:ip:${ipHash}:${bucket}`,
    `otp:v2:window:identifier:${identifierHash}:${bucket}`,
  ]
}

function retryAfterSeconds(ttlMs: number): number {
  return Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000))
}

async function increment(database: RateLimitDatabase, key: string, windowMs: number) {
  const result = await database.query<{ count: number; retry_after_ms: number }>(
    `INSERT INTO runtime_rate_limits(bucket_key, window_expires_at, count, updated_at)
     VALUES($1, now() + ($2::double precision * interval '1 millisecond'), 1, now())
     ON CONFLICT(bucket_key) DO UPDATE
       SET count = runtime_rate_limits.count + 1, updated_at = now()
     RETURNING count, GREATEST(1, CEIL(EXTRACT(epoch FROM (window_expires_at - now())) * 1000))::int AS retry_after_ms`,
    [key, windowMs],
  )
  return { count: Number(result.rows[0]?.count ?? 1), retryAfterMs: Number(result.rows[0]?.retry_after_ms ?? windowMs) }
}

export async function checkOtpRateLimit(database: RateLimitDatabase, email: string, ip: string): Promise<OtpRateLimitDecision> {
  const [cooldownKey, ipKey, identifierKey] = otpRateLimitKeys(email, ip)
  const cooldown = await database.query<{ retry_after_ms: number }>(
    `SELECT GREATEST(1, CEIL(EXTRACT(epoch FROM (window_expires_at - now())) * 1000))::int AS retry_after_ms
     FROM runtime_rate_limits WHERE bucket_key = $1 AND window_expires_at > now()`,
    [cooldownKey],
  )
  if (cooldown.rows[0]) return { allowed: false, scope: 'cooldown', retryAfterSeconds: retryAfterSeconds(Number(cooldown.rows[0].retry_after_ms)) }

  const ipCount = await increment(database, ipKey, OTP_RATE_LIMIT_POLICY.windowMs)
  const identifierCount = await increment(database, identifierKey, OTP_RATE_LIMIT_POLICY.windowMs)
  if (ipCount.count > OTP_RATE_LIMIT_POLICY.maxRequests) return { allowed: false, scope: 'ip', retryAfterSeconds: retryAfterSeconds(ipCount.retryAfterMs) }
  if (identifierCount.count > OTP_RATE_LIMIT_POLICY.maxRequests) return { allowed: false, scope: 'identifier', retryAfterSeconds: retryAfterSeconds(identifierCount.retryAfterMs) }

  await database.query(
    `INSERT INTO runtime_rate_limits(bucket_key, window_expires_at, count, updated_at)
     VALUES($1, now() + ($2::double precision * interval '1 millisecond'), 1, now())
     ON CONFLICT(bucket_key) DO UPDATE SET window_expires_at = EXCLUDED.window_expires_at, count = 1, updated_at = now()`,
    [cooldownKey, OTP_RATE_LIMIT_POLICY.cooldownMs],
  )
  return { allowed: true }
}

export function otpMetric(outcome: 'allowed' | 'blocked' | 'error', scope?: OtpRateLimitScope): void {
  console.info(JSON.stringify({ event: 'auth.otp.rate_limit', outcome, scope: scope ?? null }))
}
