import { describe, expect, it, vi } from 'vitest'
import {
  OTP_RATE_LIMIT_POLICY,
  OTP_RATE_LIMIT_SCRIPT,
  checkOtpRateLimit,
  normalizeClientAddress,
  normalizeOtpIdentifier,
  otpMetric,
  otpRateLimitKeys,
} from './otp-rate-limit'

describe('OTP distributed rate limiter', () => {
  it('normalizes identifiers and client addresses without retaining personal values in keys', () => {
    expect(normalizeOtpIdentifier('  USER@Example.com ')).toBe('user@example.com')
    expect(normalizeClientAddress(' 203.0.113.10, 10.0.0.1 ')).toBe('203.0.113.10')
    expect(normalizeClientAddress(null)).toBe('unknown')
    expect(otpRateLimitKeys('user@example.com', '203.0.113.10').every((key) => !key.includes('user@example.com'))).toBe(true)
  })

  it('uses one atomic Redis script for cooldown, IP and identifier windows', async () => {
    const evalMock = vi.fn().mockResolvedValue([1, 0, 'allowed'])
    const decision = await checkOtpRateLimit({ eval: evalMock }, 'user@example.com', '203.0.113.10')
    expect(decision).toEqual({ allowed: true })
    expect(evalMock).toHaveBeenCalledWith(
      OTP_RATE_LIMIT_SCRIPT,
      3,
      expect.stringContaining('otp:v1:cooldown:'),
      expect.stringContaining('otp:v1:window:ip:'),
      expect.stringContaining('otp:v1:window:identifier:'),
      OTP_RATE_LIMIT_POLICY.cooldownMs,
      OTP_RATE_LIMIT_POLICY.windowMs,
      OTP_RATE_LIMIT_POLICY.maxRequests,
    )
  })

  it.each([
    [[0, 45_000, 'ip'], { allowed: false, scope: 'ip', retryAfterSeconds: 45 }],
    [[0, 60_001, 'identifier'], { allowed: false, scope: 'identifier', retryAfterSeconds: 61 }],
    [[0, 1, 'cooldown'], { allowed: false, scope: 'cooldown', retryAfterSeconds: 1 }],
  ] as const)('returns Retry-After for a blocked scope', async (redisResult, expected) => {
    const decision = await checkOtpRateLimit({ eval: vi.fn().mockResolvedValue(redisResult) }, 'user@example.com', '203.0.113.10')
    expect(decision).toEqual(expected)
  })

  it('emits aggregate-only metrics', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    otpMetric('blocked', 'ip')
    expect(info).toHaveBeenCalledWith(JSON.stringify({ event: 'auth.otp.rate_limit', outcome: 'blocked', scope: 'ip' }))
    info.mockRestore()
  })
})
