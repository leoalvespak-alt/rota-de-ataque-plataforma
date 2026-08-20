import { Redis } from 'ioredis'

export const OTP_RATE_LIMIT_POLICY = {
  perEmailWindowSeconds: 300,
  perEmailMaxRequests: 3,
  perIpWindowSeconds: 60,
  perIpMaxRequests: 5,
  unavailableRetryAfterSeconds: 30,
}

export function normalizeOtpIdentifier(email: string): string {
  return email.toLowerCase().trim()
}

export function normalizeClientAddress(raw: string | null | undefined): string {
  if (!raw) return 'unknown'
  return raw.split(',')[0].trim()
}

export function otpMetric(event: 'allowed' | 'blocked' | 'error', scope?: string) {
  console.log(JSON.stringify({ event: uth.otp., scope }))
}

export async function checkOtpRateLimit(
  redis: Redis,
  email: string,
  ip: string,
): Promise<{ allowed: boolean; scope?: string; retryAfterSeconds: number }> {
  const now = Math.floor(Date.now() / 1000)

  const emailKey = otp:email:
  const emailCount = await redis.incr(emailKey)
  if (emailCount === 1) await redis.expire(emailKey, OTP_RATE_LIMIT_POLICY.perEmailWindowSeconds)
  if (emailCount > OTP_RATE_LIMIT_POLICY.perEmailMaxRequests) {
    const ttl = await redis.ttl(emailKey)
    return { allowed: false, scope: 'email', retryAfterSeconds: ttl > 0 ? ttl : OTP_RATE_LIMIT_POLICY.perEmailWindowSeconds }
  }

  if (ip !== 'unknown') {
    const ipKey = otp:ip::
    const ipCount = await redis.incr(ipKey)
    if (ipCount === 1) await redis.expire(ipKey, OTP_RATE_LIMIT_POLICY.perIpWindowSeconds)
    if (ipCount > OTP_RATE_LIMIT_POLICY.perIpMaxRequests) {
      const ttl = await redis.ttl(ipKey)
      return { allowed: false, scope: 'ip', retryAfterSeconds: ttl > 0 ? ttl : OTP_RATE_LIMIT_POLICY.perIpWindowSeconds }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}
