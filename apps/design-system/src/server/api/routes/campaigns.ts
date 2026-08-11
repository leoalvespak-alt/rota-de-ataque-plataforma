import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { editorialCampaigns } from '@/db/editorial-schema'
import { createCampaignSchema } from '@/domain/editorial/schemas'
import { db } from '../db'
import { body, notFound } from './helpers'

export const campaignRoutes = new Hono()
campaignRoutes.get('/', async (c) => c.json(await db.select().from(editorialCampaigns).orderBy(desc(editorialCampaigns.createdAt))))
campaignRoutes.get('/:id', async (c) => { const [campaign] = await db.select().from(editorialCampaigns).where(eq(editorialCampaigns.id, c.req.param('id'))); if (!campaign) notFound('Campanha'); return c.json(campaign) })
campaignRoutes.post('/', async (c) => { const input = await body(c, createCampaignSchema); const [created] = await db.insert(editorialCampaigns).values(input).returning(); return c.json(created, 201) })
campaignRoutes.put('/:id', async (c) => { const input = await body(c, createCampaignSchema.partial()); const [updated] = await db.update(editorialCampaigns).set({ ...input, updatedAt: new Date() }).where(eq(editorialCampaigns.id, c.req.param('id'))).returning(); if (!updated) notFound('Campanha'); return c.json(updated) })
campaignRoutes.delete('/:id', async (c) => { const deleted = await db.delete(editorialCampaigns).where(eq(editorialCampaigns.id, c.req.param('id'))).returning({ id: editorialCampaigns.id }); if (!deleted.length) notFound('Campanha'); return c.body(null, 204) })
