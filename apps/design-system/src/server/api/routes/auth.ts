import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  authCookieOptions,
  authenticatePassword,
  createSession,
  getAuthenticatedUserId,
  requireAuth,
} from '../auth'
import { ApiError, body } from './helpers'

const loginSchema = z.object({ password: z.string().min(12).max(512) })

export const authRoutes = new Hono()
  .post('/login', async (c) => {
    const { password } = await body(c, loginSchema)
    if (!authenticatePassword(password)) throw new ApiError(401, 'Credenciais inválidas.')
    const session = createSession()
    setCookie(c, SESSION_COOKIE, session.value, authCookieOptions)
    setCookie(c, CSRF_COOKIE, session.csrf, {
      ...authCookieOptions,
      httpOnly: false,
    })
    return c.json({ authenticated: true })
  })
  .get('/session', requireAuth, (c) => c.json({ authenticated: true, userId: getAuthenticatedUserId(c) }))
  .post('/logout', requireAuth, (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    deleteCookie(c, CSRF_COOKIE, { path: '/' })
    return c.json({ authenticated: false })
  })
  .get('/csrf', requireAuth, (c) => c.json({ present: Boolean(getCookie(c, CSRF_COOKIE)) }))
