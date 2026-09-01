import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { ApiError } from './routes/helpers'
import { pool } from './db'
import { consumePostgresRateLimit } from '@/server/infra/postgres-rate-limit'

export const OPERATOR_USER_ID = process.env.DESIGN_OPERATOR_USER_ID ?? '00000000-0000-4000-8000-000000000001'
export const SESSION_COOKIE = 'rda_design_session'
export const CSRF_COOKIE = 'rda_design_csrf'
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 30 * 24 * 60 * 60)

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function sessionSecret(): string {
  const secret = process.env.API_SESSION_SECRET
  if (!secret || secret.length < 32) throw new ApiError(503, 'AutenticaÃ§Ã£o da API nÃ£o configurada.')
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
  if (!userId) throw new ApiError(401, 'NÃ£o autorizado.')
  return userId
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const bearer = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const apiToken = process.env.API_AUTH_TOKEN
  const bearerValid = Boolean(bearer && apiToken && equalSecret(bearer, apiToken))
  const userId = bearerValid ? OPERATOR_USER_ID : verifySession(getCookie(c, SESSION_COOKIE))
  if (!userId) throw new ApiError(401, 'NÃ£o autorizado.')

  if (!bearerValid && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const cookieToken = getCookie(c, CSRF_COOKIE)
    const headerToken = c.req.header('X-CSRF-Token')
    if (!cookieToken || !headerToken || !equalSecret(cookieToken, headerToken)) throw new ApiError(403, 'Token CSRF invÃ¡lido.')
  }

  c.set('userId' as never, userId as never)
  await next()
}

export function rateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const userId = getAuthenticatedUserId(c)
    const trustedProxy = process.env.TRUST_PROXY === 'true'
    const ip = trustedProxy ? c.req.header('X-Real-IP') ?? 'proxy-unknown' : 'direct'
    try {
      const result = await consumePostgresRateLimit(pool, { namespace: 'design-api', identity: `${userId}:${ip}`, path: c.req.path, windowMs })
      c.header('X-RateLimit-Limit', String(maxRequests))
      c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - result.count)))
      if (result.count > maxRequests) throw new ApiError(429, 'Muitas requisiÃ§Ãµes. Tente novamente mais tarde.')
    } catch (error) {
      if (error instanceof ApiError) throw error
      console.error(JSON.stringify({ level: 'error', event: 'rate_limit_postgres_unavailable', path: c.req.path }))
      throw new ApiError(503, 'Limitador de requisiÃ§Ãµes indisponÃ­vel.')
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
