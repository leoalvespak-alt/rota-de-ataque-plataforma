import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'

const Body = z.object({
  action: z.enum(['approve', 'reject', 'edit', 'reschedule']),
  hook: z.string().trim().min(3).max(500).optional(),
  angle: z.string().trim().min(3).max(2000).optional(),
  scheduledFor: z.string().datetime().optional(),
}).strict()

export async function POST(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const user = await requireRole('operator')
    const input = Body.safeParse(await request.json().catch(() => null))
    if (!input.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    if (input.data.action === 'reschedule' && !input.data.scheduledFor) return NextResponse.json({ error: 'scheduledFor_required' }, { status: 400 })
    if (input.data.scheduledFor && new Date(input.data.scheduledFor).getTime() <= Date.now()) return NextResponse.json({ error: 'scheduledFor_must_be_future' }, { status: 400 })
    const { id: batchId, itemId } = await params
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const before = (await client.query(`SELECT item.*,batch.status batch_status FROM content_items item JOIN editorial_batches batch ON batch.id=item.batch_id WHERE item.id=$1 AND item.batch_id=$2 FOR UPDATE`, [itemId, batchId])).rows[0]
      if (!before) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found' }, { status: 404 }) }
      let updated
      if (input.data.action === 'reject') {
        updated = (await client.query(`UPDATE content_items SET status='archived' WHERE id=$1 RETURNING *`, [itemId])).rows[0]
        await client.query(`UPDATE review_inbox SET status='rejected',decided_by=$2,decided_at=now() WHERE item_type='content_item' AND item_ref_id=$1 AND status='pending'`, [itemId, user.email ?? 'unknown'])
      } else if (input.data.action === 'edit') {
        updated = (await client.query(`UPDATE content_items SET hook=COALESCE($2,hook),angle=COALESCE($3,angle) WHERE id=$1 AND status IN ('draft','forked') RETURNING *`, [itemId, input.data.hook ?? null, input.data.angle ?? null])).rows[0]
        if (!updated) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'edit_only_draft' }, { status: 409 }) }
      } else if (input.data.action === 'approve') {
        const ready = (await client.query<{ count: number }>(`SELECT count(*)::int count FROM content_variants WHERE content_item_id=$1 AND status IN ('draft','ready','approved')`, [itemId])).rows[0]?.count ?? 0
        if (!ready) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'variants_required' }, { status: 409 }) }
        updated = (await client.query(`UPDATE content_items SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1 AND status IN ('draft','forked') RETURNING *`, [itemId, user.email ?? 'unknown'])).rows[0]
        if (!updated) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'already_decided' }, { status: 409 }) }
        await client.query(`UPDATE content_variants SET status='approved',approved_by=$2 WHERE content_item_id=$1 AND status IN ('draft','ready')`, [itemId, user.email ?? 'unknown'])
        await client.query(`UPDATE review_inbox SET status='approved',decided_by=$2,decided_at=now() WHERE item_type='content_item' AND item_ref_id=$1 AND status='pending'`, [itemId, user.email ?? 'unknown'])
      } else {
        updated = (await client.query(`UPDATE content_variants SET scheduled_for=$2::timestamptz WHERE content_item_id=$1 AND channel='instagram' AND status IN ('approved','ready','draft') RETURNING content_item_id`, [itemId, input.data.scheduledFor])).rows[0]
        if (!updated) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'variant_required' }, { status: 409 }) }
        updated = (await client.query(`SELECT * FROM content_items WHERE id=$1`, [itemId])).rows[0]
      }
      await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`, [user.email ?? 'unknown', `editorial_item.${input.data.action}`, itemId, JSON.stringify(before), JSON.stringify({ ...updated, scheduledFor: input.data.scheduledFor ?? null })])
      await client.query('COMMIT')
      return NextResponse.json({ item: updated, action: input.data.action })
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  } catch (error) { return apiErrorResponse(error) }
}
