import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'

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

export const OTP_RATE_LIMIT_SCRIPT = `
local cooldown_ttl = redis.call('PTTL', KEYS[1])
if cooldown_ttl > 0 then
  return {0, cooldown_ttl, 'cooldown'}
end

local ip_count = redis.call('INCR', KEYS[2])
if ip_count == 1 then redis.call('PEXPIRE', KEYS[2], ARGV[2]) end
local identifier_count = redis.call('INCR', KEYS[3])
if identifier_count == 1 then redis.call('PEXPIRE', KEYS[3], ARGV[2]) end

local ip_ttl = redis.call('PTTL', KEYS[2])
local identifier_ttl = redis.call('PTTL', KEYS[3])
if ip_count > tonumber(ARGV[3]) then
  return {0, ip_ttl, 'ip'}
end
if identifier_count > tonumber(ARGV[3]) then
  return {0, identifier_ttl, 'identifier'}
end

redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
return {1, 0, 'allowed'}
`

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
  return [
    `otp:v1:cooldown:${identifierHash}`,
    `otp:v1:window:ip:${ipHash}`,
    `otp:v1:window:identifier:${identifierHash}`,
  ]
}

function retryAfterSeconds(ttlMs: number): number {
  return Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000))
}

export async function checkOtpRateLimit(redis: Pick<Redis, 'eval'>, email: string, ip: string): Promise<OtpRateLimitDecision> {
  const [cooldownKey, ipKey, identifierKey] = otpRateLimitKeys(email, ip)
  const result = await redis.eval(
    OTP_RATE_LIMIT_SCRIPT,
    3,
    cooldownKey,
    ipKey,
    identifierKey,
    OTP_RATE_LIMIT_POLICY.cooldownMs,
    OTP_RATE_LIMIT_POLICY.windowMs,
    OTP_RATE_LIMIT_POLICY.maxRequests,
  )
  if (!Array.isArray(result) || result.length < 3) throw new Error('OTP rate limiter returned an invalid result')
  const [allowed, ttlMs, rawScope] = result
  if (Number(allowed) === 1) return { allowed: true }
  const scope = rawScope === 'ip' || rawScope === 'identifier' || rawScope === 'cooldown' ? rawScope : 'identifier'
  return { allowed: false, scope, retryAfterSeconds: retryAfterSeconds(Number(ttlMs)) }
}

export function otpMetric(outcome: 'allowed' | 'blocked' | 'error', scope?: OtpRateLimitScope): void {
  console.info(JSON.stringify({ event: 'auth.otp.rate_limit', outcome, scope: scope ?? null }))
}
