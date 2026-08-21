import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db'

export const publicationRoutes = new Hono()
  .get('/', async (c) => {
    const channel = c.req.query('channel')
    const status = c.req.query('status')
    const rows = await db.execute(sql`
      SELECT
        sp.id,
        sp.title,
        sp.caption,
        sp.channel,
        sp.format,
        sp.status,
        sp.curation_status,
        sp.scheduled_for,
        sp.published_at,
        sp.batch_id,
        sp.thesis_id,
        t.title AS thesis_title,
        sp.approved_by,
        sp.origin
      FROM scheduled_publications sp
      LEFT JOIN theses t ON t.id = sp.thesis_id
      WHERE 1 = 1
        ${channel ? sql`AND sp.channel = ${channel}` : sql``}
        ${status ? sql`AND sp.status = ${status}` : sql``}
      ORDER BY sp.scheduled_for ASC
    `)
    return c.json(rows.rows)
  })
  .get('/batch/:batchId', async (c) => {
    const rows = await db.execute(sql`
      SELECT
        sp.id,
        sp.title,
        sp.caption,
        sp.channel,
        sp.format,
        sp.status,
        sp.curation_status,
        sp.scheduled_for,
        sp.published_at,
        sp.batch_id,
        sp.thesis_id,
        t.title AS thesis_title,
        sp.approved_by,
        sp.origin
      FROM scheduled_publications sp
      LEFT JOIN theses t ON t.id = sp.thesis_id
      WHERE sp.batch_id = ${c.req.param('batchId')}
      ORDER BY sp.scheduled_for ASC
    `)
    return c.json(rows.rows)
  })
