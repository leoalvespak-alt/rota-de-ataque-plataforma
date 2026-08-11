import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const ActionSchema = z.enum(['approve','edit','reject','block','snooze'])
const BodySchema = z.object({ notes: z.string().max(2000).optional(), suggestedAction: z.record(z.string(), z.unknown()).optional(), snoozeUntil: z.string().datetime().optional() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const user = await requireRole('operator')
  const { id, action: rawAction } = await params
  const action = ActionSchema.safeParse(rawAction)
  const body = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!action.success || !body.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const status = { approve: 'approved', edit: 'pending', reject: 'rejected', block: 'blocked', snooze: 'snoozed' }[action.data]
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const before = await client.query('SELECT * FROM review_inbox WHERE id=$1 FOR UPDATE', [id])
    if (!before.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found' }, { status: 404 }) }
    const result = await client.query(`UPDATE review_inbox SET status=$2,decided_by=$3,decided_at=CASE WHEN $2='pending' THEN NULL ELSE now() END,decision_notes=$4,
      suggested_action=COALESCE($5,suggested_action),context=CASE WHEN $6::text IS NULL THEN context ELSE context || jsonb_build_object('snooze_until',$6::text) END WHERE id=$1 RETURNING *`, [id, status, user.email, body.data.notes ?? null, body.data.suggestedAction ? JSON.stringify(body.data.suggestedAction) : null, body.data.snoozeUntil ?? null])
    await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4,$5)`, [user.email, `review.${action.data}`, id, before.rows[0], result.rows[0]])
    await client.query('COMMIT')
    if (action.data === 'approve' && ['private_reply','dm_draft','conversation_reply','whatsapp_message','content_variant'].includes(result.rows[0].item_type)) {
      const registry = createQueueRegistry(process.env.REDIS_URL!)
      try {
        if (result.rows[0].item_type === 'private_reply') await enqueueOnce(registry.queues['private-reply'], 'private-reply', ['review', id], { commentId: result.rows[0].item_ref_id, approved: true, reviewId: id, accountRole: 'actor', synthetic: false })
        else if (result.rows[0].item_type === 'whatsapp_message') await enqueueOnce(registry.queues['whatsapp-outbound'], 'whatsapp-outbound', ['review', id], { messageId: result.rows[0].item_ref_id, reviewId: id, approvedBy: user.email, accountRole: 'actor', synthetic: false })
        else if (result.rows[0].item_type === 'content_variant') { await client.query(`UPDATE content_variants SET status='approved',approved_by=$2 WHERE id=$1`, [result.rows[0].item_ref_id,user.email]); await enqueueOnce(registry.queues['threads-publisher'], 'threads-publisher', ['review', id], { variantId: result.rows[0].item_ref_id, approvedBy: user.email, accountRole: 'actor', synthetic: false }) }
        else {
          const draft = (await client.query(`SELECT lead_id,thread_id,created_at FROM dm_drafts WHERE id=$1`, [result.rows[0].item_ref_id])).rows[0]
          if (draft) await enqueueOnce(registry.queues['dm-copilot'], 'dm-copilot', ['review', id], { threadId: draft.thread_id, leadId: draft.lead_id, triggerKind: 'inbound', inboundAt: new Date(draft.created_at).toISOString(), approved: true, reviewId: id, accountRole: 'actor', synthetic: false })
        }
      } finally { await registry.connection.quit() }
    }
    return NextResponse.json({ item: result.rows[0] })
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release(); await pool.end() }
}
