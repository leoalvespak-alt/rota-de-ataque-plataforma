import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import Redis from 'ioredis'
import { ApiError } from './routes/helpers'

export const OPERATOR_USER_ID = process.env.DESIGN_OPERATOR_USER_ID ?? '00000000-0000-4000-8000-000000000001'
export const SESSION_COOKIE = 'rda_design_session'
export const CSRF_COOKIE = 'rda_design_csrf'
const SESSION_TTL_SECONDS = 12 * 60 * 60

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function sessionSecret(): string {
  const secret = process.env.API_SESSION_SECRET
  if (!secret || secret.length < 32) throw new ApiError(503, 'Autenticação da API não configurada.')
  return secret
}

export function createSession(userId = OPERATOR_USER_ID): { value: string; csrf: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString('base64url')
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  return { value: `${payload}.${signature}`, csrf: randomBytes(24).toString('base64url') }
}

function verifySession(value: string | undefined): string | null {
  if (!value) return null
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  if (!equalSecret(signature, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; expiresAt?: number }
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt <= Date.now() / 1000) return null
    return parsed.userId
  } catch {
    return null
  }
}

export function authenticatePassword(password: string): boolean {
  const expected = process.env.DESIGN_API_PASSWORD
  return Boolean(expected && expected.length >= 12 && equalSecret(password, expected))
}

export function getAuthenticatedUserId(c: Context): string {
  const userId = c.get('userId' as never) as string | undefined
  if (!userId) throw new ApiError(401, 'Não autorizado.')
  return userId
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const bearer = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const apiToken = process.env.API_AUTH_TOKEN
  const bearerValid = Boolean(bearer && apiToken && equalSecret(bearer, apiToken))
  const userId = bearerValid ? OPERATOR_USER_ID : verifySession(getCookie(c, SESSION_COOKIE))
  if (!userId) throw new ApiError(401, 'Não autorizado.')

  if (!bearerValid && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const cookieToken = getCookie(c, CSRF_COOKIE)
    const headerToken = c.req.header('X-CSRF-Token')
    if (!cookieToken || !headerToken || !equalSecret(cookieToken, headerToken)) {
      throw new ApiError(403, 'Token CSRF inválido.')
    }
  }

  c.set('userId' as never, userId as never)
  await next()
}

let redis: Redis | undefined
function rateLimitRedis(): Redis {
  const url = process.env.REDIS_URL
  if (!url) throw new ApiError(503, 'Rate limit distribuído não configurado.')
  redis ??= new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
  return redis
}

export function rateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const userId = getAuthenticatedUserId(c)
    const trustedProxy = process.env.TRUST_PROXY === 'true'
    const ip = trustedProxy ? c.req.header('X-Real-IP') ?? 'proxy-unknown' : 'direct'
    const bucket = Math.floor(Date.now() / windowMs)
    const key = `design-api:rate:${userId}:${ip}:${c.req.path}:${bucket}`
    try {
      const client = rateLimitRedis()
      if (client.status === 'wait') await client.connect()
      const count = await client.incr(key)
      if (count === 1) await client.pexpire(key, windowMs)
      c.header('X-RateLimit-Limit', String(maxRequests))
      c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)))
      if (count > maxRequests) throw new ApiError(429, 'Muitas requisições. Tente novamente mais tarde.')
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(503, 'Rate limit temporariamente indisponível.')
    }
    await next()
  }
}

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
}
