import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { editorialAngles, editorialDepthLevels, editorialHooks, editorialIntents } from '@/db/editorial-schema'
import { db } from '../db'
export const taxonomyRoutes = new Hono()
taxonomyRoutes.get('/', async (c) => c.json({ intents: await db.select().from(editorialIntents).where(eq(editorialIntents.active, true)).orderBy(asc(editorialIntents.position)), angles: await db.select().from(editorialAngles).where(eq(editorialAngles.active, true)).orderBy(asc(editorialAngles.position)), depths: await db.select().from(editorialDepthLevels).orderBy(asc(editorialDepthLevels.position)), hooks: await db.select().from(editorialHooks).where(eq(editorialHooks.active, true)) }))
