import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { OTP_RATE_LIMIT_POLICY, checkOtpRateLimit, normalizeClientAddress, normalizeOtpIdentifier, otpMetric } from '@/lib/otp-rate-limit'

const RequestSchema = z.object({ email: z.string().trim().email().max(254) }).strict()
function responseWithRetryAfter(body: Record<string, unknown>, status: number, retryAfterSeconds: number): NextResponse { return NextResponse.json(body, { status, headers: { 'Retry-After': String(retryAfterSeconds) } }) }

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !process.env.OTP_SECRET || !process.env.DATABASE_URL) return NextResponse.json({ ok: false, error: 'invalid_request', traceId }, { status: 400 })
  const email = normalizeOtpIdentifier(parsed.data.email)
  const ip = normalizeClientAddress(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
  const { pool } = createDatabase(process.env.DATABASE_URL)
  let decision: Awaited<ReturnType<typeof checkOtpRateLimit>>
  try { decision = await checkOtpRateLimit(pool, email, ip) } catch (error) {
    otpMetric('error')
    console.error(JSON.stringify({ event: 'auth.otp.rate_limit_error', traceId, error: error instanceof Error ? error.name : 'unknown' }))
    return responseWithRetryAfter({ ok: false, error: 'rate_limiter_unavailable', traceId }, 503, OTP_RATE_LIMIT_POLICY.unavailableRetryAfterSeconds)
  }
  if (!decision.allowed) { otpMetric('blocked', decision.scope); return responseWithRetryAfter({ ok: false, error: 'rate_limited', traceId }, 429, decision.retryAfterSeconds) }
  otpMetric('allowed')
  return NextResponse.json({ ok: false, error: 'otp_delivery_deferred_to_later_phase', traceId }, { status: 503 })
}
