import { describe, expect, it, vi } from 'vitest'
import { OTP_RATE_LIMIT_POLICY, checkOtpRateLimit, normalizeClientAddress, normalizeOtpIdentifier, otpMetric, otpRateLimitKeys } from './otp-rate-limit'

function databaseMock(rows: unknown[][]) {
  const query = vi.fn()
  for (const row of rows) query.mockResolvedValueOnce({ rows: row })
  return { query }
}

describe('OTP PostgreSQL rate limiter', () => {
  it('normalizes identifiers and never places personal values in keys', () => {
    expect(normalizeOtpIdentifier('  USER@Example.com ')).toBe('user@example.com')
    expect(normalizeClientAddress(' 203.0.113.10, 10.0.0.1 ')).toBe('203.0.113.10')
    expect(normalizeClientAddress(null)).toBe('unknown')
    expect(otpRateLimitKeys('user@example.com', '203.0.113.10').every((key) => !key.includes('user@example.com'))).toBe(true)
  })

  it('persists cooldown and both rolling counters in PostgreSQL', async () => {
    const database = databaseMock([[], [{ count: 1, retry_after_ms: OTP_RATE_LIMIT_POLICY.windowMs }], [{ count: 1, retry_after_ms: OTP_RATE_LIMIT_POLICY.windowMs }], []])
    await expect(checkOtpRateLimit(database, 'user@example.com', '203.0.113.10')).resolves.toEqual({ allowed: true })
    expect(database.query).toHaveBeenCalledTimes(4)
    expect(database.query.mock.calls.some(([sql]) => String(sql).includes('runtime_rate_limits'))).toBe(true)
  })

  it('returns the database expiry for a blocked scope', async () => {
    const database = databaseMock([[], [{ count: 6, retry_after_ms: 45_000 }], [{ count: 1, retry_after_ms: 900_000 }]])
    await expect(checkOtpRateLimit(database, 'user@example.com', '203.0.113.10')).resolves.toEqual({ allowed: false, scope: 'ip', retryAfterSeconds: 45 })
  })

  it('emits aggregate-only metrics', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    otpMetric('blocked', 'ip')
    expect(info).toHaveBeenCalledWith(JSON.stringify({ event: 'auth.otp.rate_limit', outcome: 'blocked', scope: 'ip' }))
    info.mockRestore()
  })
})
