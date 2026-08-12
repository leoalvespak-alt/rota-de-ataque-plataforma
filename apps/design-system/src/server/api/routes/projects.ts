import { Hono } from 'hono'
import { db } from '../db'
import { creativeProjects, type CreativeProjectStatus } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ApiError } from './helpers'

const VALID_STATUSES: CreativeProjectStatus[] = ['nao_iniciado', 'em_andamento', 'finalizado']

export const projectRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(creativeProjects).orderBy(desc(creativeProjects.updatedAt))
    return c.json(rows)
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id')
    const [row] = await db.select().from(creativeProjects).where(eq(creativeProjects.id, id))
    if (!row) throw new ApiError(404, 'Projeto não encontrado')
    return c.json(row)
  })
  .post('/', async (c) => {
    const body = await c.req.json()
    const [row] = await db.insert(creativeProjects).values({
      title: body.title,
      description: body.description,
      format: body.format,
      templateId: body.templateId,
      cardCount: body.cardCount,
      wizardData: body.wizardData,
    }).returning()
    return c.json(row, 201)
  })
  .patch('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      throw new ApiError(400, `Status inválido. Use: ${VALID_STATUSES.join(', ')}`)
    }
    const [row] = await db.update(creativeProjects)
      .set({
        ...body,
        updatedAt: new Date(),
        completedAt: body.status === 'finalizado' ? new Date() : undefined,
      })
      .where(eq(creativeProjects.id, id))
      .returning()
    if (!row) throw new ApiError(404, 'Projeto não encontrado')
    return c.json(row)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')
    const [row] = await db.delete(creativeProjects).where(eq(creativeProjects.id, id)).returning()
    if (!row) throw new ApiError(404, 'Projeto não encontrado')
    return c.json({ deleted: true })
  })
