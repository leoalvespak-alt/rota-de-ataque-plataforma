import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
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
import { getEditorialMetrics } from '@/server/editorial/metrics'

const app = new Hono()
app.use('*', cors({ origin: [process.env.WEB_ORIGIN ?? 'http://localhost:5173'], allowHeaders: ['Content-Type'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/api/theses', thesesRoutes).route('/api/theses', thesisArgumentsRoutes).route('/api/theses', thesisStructurerRoutes)
app.route('/api/knowledge', knowledgeRoutes).route('/api/campaigns', campaignRoutes).route('/api/plans', planRoutes).route('/api/batch', batchRoutes).route('/api/reviews', reviewRoutes).route('/api/prompts', promptRoutes).route('/api/taxonomy', taxonomyRoutes)
app.route('/api/projects', projectRoutes).route('/api/token-logs', tokenLogRoutes).route('/api/profiles', profileRoutes)
app.get('/api/metrics', async (c) => c.json(await getEditorialMetrics()))
app.onError((error, c) => { if (error instanceof ApiError) return c.json({ error: error.message, detail: error.detail }, error.status as 400); console.error(error); return c.json({ error: 'Erro interno da API.' }, 500) })
const port = Number(process.env.API_PORT ?? 3001)
serve({ fetch: app.fetch, port })
export default app
