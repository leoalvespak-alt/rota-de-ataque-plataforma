import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { creativeProjects } from '@/db/schema'
import { getAuthenticatedUserId } from '../auth'
import { db } from '../db'
import { ApiError, body } from './helpers'

const statusSchema = z.enum(['nao_iniciado', 'em_andamento', 'finalizado'])
const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10_000).optional(),
  format: z.string().max(50).optional(),
  templateId: z.string().max(100).optional(),
  cardCount: z.number().int().min(1).max(10).optional(),
  wizardData: z.record(z.string(), z.unknown()).optional(),
})
const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  status: statusSchema.optional(),
  format: z.string().max(50).nullable().optional(),
  templateId: z.string().max(100).nullable().optional(),
  cardCount: z.number().int().min(1).max(10).optional(),
  wizardStep: z.number().int().min(1).max(5).optional(),
  wizardData: z.record(z.string(), z.unknown()).optional(),
  elements: z.record(z.string(), z.unknown()).optional(),
  slides: z.array(z.record(z.string(), z.unknown())).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  profileId: z.string().uuid().nullable().optional(),
}).strict()

export const projectRoutes = new Hono()
  .get('/', async (c) => {
    const userId = getAuthenticatedUserId(c)
    return c.json(await db.select().from(creativeProjects).where(eq(creativeProjects.userId, userId)).orderBy(desc(creativeProjects.updatedAt)))
  })
  .get('/:id', async (c) => {
    const [row] = await db.select().from(creativeProjects).where(and(eq(creativeProjects.id, c.req.param('id')), eq(creativeProjects.userId, getAuthenticatedUserId(c))))
    if (!row) throw new ApiError(404, 'Projeto não encontrado.')
    return c.json(row)
  })
  .post('/', async (c) => {
    const input = await body(c, createProjectSchema)
    const [row] = await db.insert(creativeProjects).values({ ...input, userId: getAuthenticatedUserId(c) }).returning()
    return c.json(row, 201)
  })
  .patch('/:id', async (c) => {
    const input = await body(c, updateProjectSchema)
    const [row] = await db.update(creativeProjects).set({
      ...input,
      updatedAt: new Date(),
      ...(input.status === 'finalizado' ? { completedAt: new Date() } : input.status ? { completedAt: null } : {}),
    }).where(and(eq(creativeProjects.id, c.req.param('id')), eq(creativeProjects.userId, getAuthenticatedUserId(c)))).returning()
    if (!row) throw new ApiError(404, 'Projeto não encontrado.')
    return c.json(row)
  })
  .delete('/:id', async (c) => {
    const [row] = await db.delete(creativeProjects).where(and(eq(creativeProjects.id, c.req.param('id')), eq(creativeProjects.userId, getAuthenticatedUserId(c)))).returning()
    if (!row) throw new ApiError(404, 'Projeto não encontrado.')
    return c.json({ deleted: true })
  })
