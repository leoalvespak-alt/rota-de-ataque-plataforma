import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sql } from 'drizzle-orm'
import { ApiError } from './routes/helpers'
import { batchRoutes } from './routes/batch'
import { campaignRoutes } from './routes/campaigns'
import { knowledgeRoutes } from './routes/knowledge'
import { planRoutes } from './routes/plans'
import { promptRoutes } from './routes/prompts'
import { reviewRoutes } from './routes/reviews'
import { taxonomyRoutes } from './routes/taxonomy'
import { thesisArgumentsRoutes } from './routes/thesis-arguments'
import { thesisStructurerRoutes } from './routes/thesis-structurer'
import { thesesRoutes } from './routes/theses'
import { projectRoutes } from './routes/projects'
import { tokenLogRoutes } from './routes/token-logs'
import { profileRoutes } from './routes/profiles'
import { publicationRoutes } from './routes/publications'
import { aiRoutes } from './routes/ai'
import { authRoutes } from './routes/auth'
import { requireAuth } from './auth'
import { db } from './db'
import { getEditorialMetrics } from '@/server/editorial/metrics'

const app = new Hono()
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID()
  c.header('X-Request-ID', requestId)
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'same-origin')
  await next()
})
app.use('*', cors({
  origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID', 'Idempotency-Key'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.get('/health', (c) => c.json({ status: 'ok', release: process.env.RELEASE_ID ?? 'development' }))
app.get('/api/health', (c) => c.json({ status: 'ok', release: process.env.RELEASE_ID ?? 'development' }))
app.get('/api/ready', async (c) => {
  try {
    await db.execute(sql`select 1`)
    return c.json({ status: 'ready', database: 'ok' })
  } catch {
    return c.json({ status: 'not_ready', database: 'unavailable' }, 503)
  }
})
app.route('/api/auth', authRoutes)
app.use('/api/*', requireAuth)
app.route('/api/theses', thesesRoutes).route('/api/theses', thesisArgumentsRoutes).route('/api/theses', thesisStructurerRoutes)
app.route('/api/knowledge', knowledgeRoutes).route('/api/campaigns', campaignRoutes).route('/api/plans', planRoutes).route('/api/batch', batchRoutes).route('/api/reviews', reviewRoutes).route('/api/prompts', promptRoutes).route('/api/taxonomy', taxonomyRoutes)
app.route('/api/projects', projectRoutes).route('/api/token-logs', tokenLogRoutes).route('/api/profiles', profileRoutes)
app.route('/api/publications', publicationRoutes)
app.route('/api/ai', aiRoutes)
app.get('/api/metrics', async (c) => c.json(await getEditorialMetrics()))
app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404))
app.onError((error, c) => {
  const requestId = c.res.headers.get('X-Request-ID')
  if (error instanceof ApiError) return c.json({ error: error.message, detail: error.detail, requestId }, error.status as 400)
  console.error(JSON.stringify({ level: 'error', requestId, message: error instanceof Error ? error.message : 'unknown' }))
  return c.json({ error: 'Erro interno da API.', requestId }, 500)
})
const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port })
export default app
