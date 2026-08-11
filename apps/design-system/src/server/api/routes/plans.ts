import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { editorialAngles, editorialIntents, editorialPlanItems, editorialPlans, editorialTheses } from '@/db/editorial-schema'
import { createPlanItemSchema, createPlanSchema } from '@/domain/editorial/schemas'
import { generatePlan } from '@/server/editorial/planner'
import { db } from '../db'
import { body, notFound } from './helpers'

export const planRoutes = new Hono()
planRoutes.post('/generate', async (c) => { const input = await body(c, createPlanSchema); const theses = await db.select().from(editorialTheses); const [intents, angles] = await Promise.all([db.select().from(editorialIntents).where(eq(editorialIntents.active, true)), db.select().from(editorialAngles).where(eq(editorialAngles.active, true))]); const selected = theses.filter((thesis) => input.thesisIds.includes(thesis.id)); const items = generatePlan({ theses: selected, intents, angles, quantities: input.quantities, start: input.periodStart, end: input.periodEnd, minimumGap: Number(input.config.minimumGap ?? 2) }); const [plan] = await db.insert(editorialPlans).values({ campaignId: input.campaignId, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, totalItems: items.length, config: { ...input.config, quantities: input.quantities }, status: 'draft' }).returning(); if (items.length) await db.insert(editorialPlanItems).values(items.map((item) => ({ ...item, planId: plan!.id, status: 'planned' }))); return c.json({ ...plan, items }, 201) })
planRoutes.get('/:id', async (c) => { const [plan] = await db.select().from(editorialPlans).where(eq(editorialPlans.id, c.req.param('id'))); if (!plan) notFound('Plano'); const items = await db.select().from(editorialPlanItems).where(eq(editorialPlanItems.planId, plan.id)).orderBy(asc(editorialPlanItems.position)); return c.json({ ...plan, items }) })
planRoutes.put('/:id', async (c) => { const patch = await c.req.json() as Record<string, unknown>; const [plan] = await db.update(editorialPlans).set({ ...patch, updatedAt: new Date() }).where(eq(editorialPlans.id, c.req.param('id'))).returning(); if (!plan) notFound('Plano'); return c.json(plan) })
planRoutes.patch('/:id/approve', async (c) => { const [plan] = await db.update(editorialPlans).set({ status: 'approved', approvedAt: new Date(), approvedBy: 'editor', updatedAt: new Date() }).where(eq(editorialPlans.id, c.req.param('id'))).returning(); if (!plan) notFound('Plano'); return c.json(plan) })
planRoutes.patch('/:id/items/:itemId', async (c) => { const patch = await body(c, createPlanItemSchema.partial()); const [item] = await db.update(editorialPlanItems).set({ ...patch, updatedAt: new Date() }).where(eq(editorialPlanItems.id, c.req.param('itemId'))).returning(); if (!item) notFound('Item do plano'); return c.json(item) })
planRoutes.post('/:id/generate-content', async (c) => c.redirect(`/api/batch/start`, 307))
