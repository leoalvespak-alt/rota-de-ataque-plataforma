import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'
import { z } from 'zod'

const CreateCreativeSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  caption: z.string().optional(),
  channel: z.string().min(1, 'Canal é obrigatório'),
  format: z.string().min(1, 'Formato é obrigatório'),
  status: z.string().default('draft'),
  scheduled_for: z.string().optional().nullable(),
  thesis_id: z.string().uuid().optional().nullable(),
  origin: z.string().default('design-system'),
})

const UpdateCreativeSchema = CreateCreativeSchema.partial()

async function parseBody<T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<{ data: T } | { error: Response }> {
  try {
    const raw = await (c as Parameters<typeof parseBody>[0]).req.json()
    const result = schema.safeParse(raw)
    if (!result.success) {
      return { error: new Response(JSON.stringify({ error: result.error.errors[0]?.message ?? 'Dados inválidos' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
    }
    return { data: result.data }
  } catch {
    return { error: new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
  }
}

export const publicationRoutes = new Hono()
  .get('/', async (c) => {
    const channel = c.req.query('channel')
    const status = c.req.query('status')
    const origin = c.req.query('origin')

    const rows = await db.execute(sql`
      SELECT
        uc.id,
        uc.title,
        uc.caption,
        uc.channel,
        uc.format,
        uc.status,
        uc.curation_status,
        uc.scheduled_for,
        uc.published_at,
        uc.batch_id,
        uc.thesis_id,
        t.title AS thesis_title,
        uc.approved_by,
        uc.origin
      FROM unified_creatives uc
      LEFT JOIN theses t ON t.id = uc.thesis_id
      WHERE 1 = 1
        ${channel ? sql`AND uc.channel = ${channel}` : sql``}
        ${status ? sql`AND uc.status = ${status}` : sql``}
        ${origin ? sql`AND uc.origin = ${origin}` : sql``}
      ORDER BY uc.scheduled_for ASC
    `)
    return c.json(rows.rows)
  })
  .get('/batch/:batchId', async (c) => {
    const rows = await db.execute(sql`
      SELECT
        uc.id,
        uc.title,
        uc.caption,
        uc.channel,
        uc.format,
        uc.status,
        uc.curation_status,
        uc.scheduled_for,
        uc.published_at,
        uc.batch_id,
        uc.thesis_id,
        t.title AS thesis_title,
        uc.approved_by,
        uc.origin
      FROM unified_creatives uc
      LEFT JOIN theses t ON t.id = uc.thesis_id
      WHERE uc.batch_id = ${c.req.param('batchId')}
      ORDER BY uc.scheduled_for ASC
    `)
    return c.json(rows.rows)
  })
  .post('/', async (c) => {
    const parsed = await parseBody(c, CreateCreativeSchema)
    if ('error' in parsed) return parsed.error
    const data = parsed.data
    const row = await db.execute(sql`
      INSERT INTO unified_creatives (
        title, caption, channel, format, status, scheduled_for, thesis_id, origin
      ) VALUES (
        ${data.title},
        ${data.caption ?? null},
        ${data.channel},
        ${data.format},
        ${data.status},
        ${data.scheduled_for ? sql`${data.scheduled_for}::timestamptz` : null},
        ${data.thesis_id ?? null},
        ${data.origin}
      )
      RETURNING *
    `)
    return c.json(row.rows[0], 201)
  })
  .patch('/:id', async (c) => {
    const id = c.req.param('id')
    const parsed = await parseBody(c, UpdateCreativeSchema)
    if ('error' in parsed) return parsed.error
    const data = parsed.data

    const updates = []
    if (data.title !== undefined) updates.push(sql`title = ${data.title}`)
    if (data.caption !== undefined) updates.push(sql`caption = ${data.caption}`)
    if (data.channel !== undefined) updates.push(sql`channel = ${data.channel}`)
    if (data.format !== undefined) updates.push(sql`format = ${data.format}`)
    if (data.status !== undefined) updates.push(sql`status = ${data.status}`)
    if (data.scheduled_for !== undefined) updates.push(sql`scheduled_for = ${data.scheduled_for ? sql`${data.scheduled_for}::timestamptz` : sql`NULL`}`)
    if (data.thesis_id !== undefined) updates.push(sql`thesis_id = ${data.thesis_id ?? sql`NULL`}`)
    if (data.origin !== undefined) updates.push(sql`origin = ${data.origin}`)

    if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400)

    const joinedUpdates = sql.join(updates, sql`, `)

    const row = await db.execute(sql`
      UPDATE unified_creatives
      SET ${joinedUpdates}
      WHERE id = ${id}
      RETURNING *
    `)

    if (row.rows.length === 0) return c.json({ error: 'Criativo não encontrado' }, 404)
    return c.json(row.rows[0])
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')
    const row = await db.execute(sql`
      DELETE FROM unified_creatives WHERE id = ${id} RETURNING id
    `)
    if (row.rows.length === 0) return c.json({ error: 'Criativo não encontrado' }, 404)
    return c.json({ deleted: true, id })
  })
