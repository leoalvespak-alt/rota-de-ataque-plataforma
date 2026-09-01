import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { contentItems, editorialPlanItems, editorialPlans, generationJobs } from '@/db/editorial-schema'
import { db } from '../db'
import { notFound } from './helpers'

export const batchRoutes = new Hono()
batchRoutes.post('/start', async (c) => {
  const { planId } = await c.req.json() as { planId?: string }
  if (!planId) return c.json({ error: 'planId Ã© obrigatÃ³rio.' }, 400)
  const [plan] = await db.select().from(editorialPlans).where(eq(editorialPlans.id, planId))
  if (!plan) notFound('Plano')
  if (plan.status !== 'approved') return c.json({ error: 'Aprove o plano antes de iniciar o lote.' }, 409)
  const [existing] = await db.select().from(generationJobs).where(and(eq(generationJobs.planId, planId), inArray(generationJobs.status, ['pending', 'active', 'paused'])))
  if (existing) return c.json(existing, 200)
  const [job] = await db.insert(generationJobs).values({ planId, campaignId: plan.campaignId, type: 'plan_campaign', status: 'pending', inputData: { planId, execution: 'direct-postgres' } }).returning()
  await db.update(editorialPlans).set({ status: 'generating', updatedAt: new Date() }).where(eq(editorialPlans.id, planId))
  return c.json(job, 202)
})
batchRoutes.get('/:id/status', async (c) => {
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, c.req.param('id')))
  if (!job) notFound('Lote')
  const [statuses] = await db.select({ total: count(), pending: sql<number>`count(*) filter (where ${contentItems.status} = 'draft')::int`, generating: sql<number>`count(*) filter (where ${contentItems.status} = 'generating')::int`, approved: sql<number>`count(*) filter (where ${contentItems.status} = 'approved')::int`, failed: sql<number>`count(*) filter (where ${contentItems.status} = 'failed')::int` }).from(contentItems).innerJoin(editorialPlanItems, eq(contentItems.planItemId, editorialPlanItems.id)).where(eq(editorialPlanItems.planId, job.planId!))
  return c.json({ job, progress: statuses })
})
for (const [path, status] of [['pause', 'paused'], ['resume', 'active'], ['cancel', 'cancelled']] as const) batchRoutes.post(`/:id/${path}`, async (c) => {
  const [updated] = await db.update(generationJobs).set({ status }).where(eq(generationJobs.id, c.req.param('id'))).returning()
  if (!updated) notFound('Lote')
  return c.json(updated)
})
batchRoutes.post('/:id/retry-failed', async (c) => {
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, c.req.param('id')))
  if (!job) notFound('Lote')
  const failed = await db.select({ id: contentItems.id }).from(contentItems).innerJoin(editorialPlanItems, eq(contentItems.planItemId, editorialPlanItems.id)).where(and(eq(editorialPlanItems.planId, job.planId!), eq(contentItems.status, 'failed')))
  if (failed.length) await db.update(contentItems).set({ status: 'generating' }).where(inArray(contentItems.id, failed.map((item) => item.id)))
  return c.json({ retried: failed.length })
})
batchRoutes.post('/:id/approve-all', async (c) => {
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, c.req.param('id')))
  if (!job) notFound('Lote')
  const result = await db.update(contentItems).set({ status: 'approved', updatedAt: new Date() }).from(editorialPlanItems).where(and(eq(contentItems.planItemId, editorialPlanItems.id), eq(editorialPlanItems.planId, job.planId!), eq(contentItems.status, 'ready_for_approval'))).returning({ id: contentItems.id })
  return c.json({ approved: result.length })
})
