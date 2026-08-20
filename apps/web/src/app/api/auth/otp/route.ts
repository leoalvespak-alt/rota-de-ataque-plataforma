import { NextResponse } from 'next/server'
import { Redis } from 'ioredis'
import { z } from 'zod'
import { ResendEmailChannel } from '@plataforma/notifications'
import { otpFor } from '@/lib/otp'
import { OTP_RATE_LIMIT_POLICY, checkOtpRateLimit, normalizeClientAddress, normalizeOtpIdentifier, otpMetric } from '@/lib/otp-rate-limit'

const RequestSchema = z.object({ email: z.string().trim().email().max(254) }).strict()
let redisClient: Redis | undefined

function getRedis(): Redis {
  if (redisClient) return redisClient
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) throw new Error('REDIS_URL is required for OTP rate limiting')
  redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
  return redisClient
}

function responseWithRetryAfter(body: Record<string, unknown>, status: number, retryAfterSeconds: number): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Retry-After': String(retryAfterSeconds) } })
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !process.env.OTP_SECRET) return NextResponse.json({ ok: false, error: 'invalid_request', traceId }, { status: 400 })

  const email = normalizeOtpIdentifier(parsed.data.email)
  const ip = normalizeClientAddress(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
  let decision: Awaited<ReturnType<typeof checkOtpRateLimit>>
  try {
    decision = await checkOtpRateLimit(getRedis(), email, ip)
  } catch (error) {
    otpMetric('error')
    console.error(JSON.stringify({ event: 'auth.otp.rate_limit_error', traceId, error: error instanceof Error ? error.name : 'unknown' }))
    return responseWithRetryAfter({ ok: false, error: 'rate_limiter_unavailable', traceId }, 503, OTP_RATE_LIMIT_POLICY.unavailableRetryAfterSeconds)
  }
  if (!decision.allowed) {
    otpMetric('blocked', decision.scope)
    return responseWithRetryAfter({ ok: false, error: 'rate_limited', traceId }, 429, decision.retryAfterSeconds)
  }
  otpMetric('allowed')

  try {
    const code = otpFor(email, process.env.OTP_SECRET)
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      const channel = new ResendEmailChannel(process.env.RESEND_API_KEY, process.env.RESEND_FROM, [email])
      await channel.send({ kind: 'Código de acesso', severity: 'info', campaign: 'Plataforma', message: `Seu código é ${code}. Expira em 5 minutos.`, dashboardUrl: process.env.APP_URL ?? 'http://localhost:3000', traceId })
    }
    return NextResponse.json({ ok: true, traceId })
  } catch (error) {
    console.error(JSON.stringify({ event: 'auth.otp.provider_error', traceId, error: error instanceof Error ? error.name : 'unknown' }))
    return NextResponse.json({ ok: false, error: 'provider_error', traceId }, { status: 502 })
  }
}
