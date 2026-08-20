import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const Update = z.object({ hook: z.string().trim().min(3).max(500).optional(), angle: z.string().trim().min(3).max(2000).optional(), objective: z.string().trim().max(500).nullable().optional(), audienceSegment: z.string().trim().max(300).nullable().optional(), arguments: z.array(z.string().trim().min(1).max(1000)).max(30).optional(), cta: z.record(z.string(), z.unknown()).optional(), archive: z.boolean().optional() }).strict()

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('operator')
    const input = Update.safeParse(await request.json().catch(() => null))
    if (!input.success) return invalidRequestResponse()
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN'); await client.query("SET LOCAL app.actor_type = 'human'")
      const id = (await params).id
      const before = (await client.query<Record<string, unknown>>(`SELECT * FROM content_items WHERE id=$1 FOR UPDATE`, [id])).rows[0]
      if (!before) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found' }, { status: 404 }) }
      const body = input.data
      const item = (await client.query(
        `UPDATE content_items SET hook=COALESCE($2,hook),angle=COALESCE($3,angle),objective=COALESCE($4,objective),audience_segment=COALESCE($5,audience_segment),arguments=COALESCE($6::jsonb,arguments),cta=COALESCE($7::jsonb,cta),status=CASE WHEN $8 THEN 'archived' ELSE status END WHERE id=$1 RETURNING *`,
        [id,body.hook ?? null,body.angle ?? null,body.objective ?? null,body.audienceSegment ?? null,body.arguments ? JSON.stringify(body.arguments) : null,body.cta ? JSON.stringify(body.cta) : null,body.archive ?? false],
      )).rows[0]
      const revision = Number((await client.query<{ revision: number }>(`SELECT COALESCE(MAX(revision),0)+1 revision FROM content_item_revisions WHERE content_item_id=$1`, [id])).rows[0]?.revision ?? 1)
      await client.query(`INSERT INTO content_item_revisions(content_item_id,revision,snapshot,changed_by) VALUES($1,$2,$3::jsonb,$4)`, [id,revision,JSON.stringify(before),user.email ?? null])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'content_item.updated',$2,$3::jsonb,$4::jsonb)`, [user.email ?? 'unknown',id,JSON.stringify(before),JSON.stringify(item)])
      await client.query('COMMIT'); return NextResponse.json({ item })
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  } catch (error) { return apiErrorResponse(error) }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('operator')
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    try {
      const id = (await params).id
      const result = await pool.query<Record<string, unknown>>(`UPDATE content_items SET status='archived' WHERE id=$1 AND status IN ('draft','forked') RETURNING *`, [id])
      if (!result.rowCount) return NextResponse.json({ error: 'archive_only_draft_or_forked' }, { status: 409 })
      await pool.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'content_item.archived',$2,$3::jsonb,$4::jsonb)`, [user.email ?? 'unknown',id,JSON.stringify(result.rows[0]),JSON.stringify({ status:'archived' })])
      return NextResponse.json({ ok: true })
    } finally {}
  } catch (error) { return apiErrorResponse(error) }
}
