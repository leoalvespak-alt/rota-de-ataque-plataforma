import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const ActionSchema = z.enum(['approve', 'edit', 'reject', 'block', 'snooze', 'undo'])
const BodySchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  suggestedAction: z.record(z.string(), z.unknown()).optional(),
  snoozeUntil: z.string().datetime().optional(),
  undoToken: z.string().uuid().optional(),
  version: z.number().int().nonnegative().optional(),
}).strict()
const IdSchema = z.string().uuid()
const UNDO_WINDOW = "15 minutes"

type ReviewRow = Record<string, unknown> & {
  id: string
  status: string
  item_type: string
  item_ref_id: string | null
  decision_version: number
  undo_token: string | null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const { id, action: rawAction } = await params
  const action = ActionSchema.safeParse(rawAction)
  const parsedId = IdSchema.safeParse(id)
  const body = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!action.success || !parsedId.success || !body.success) return invalidRequestResponse('invalid_request')

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  let item: ReviewRow
  try {
    await client.query('BEGIN')
    const before = (await client.query<ReviewRow>('SELECT * FROM review_inbox WHERE id=$1 FOR UPDATE', [parsedId.data])).rows[0]
    if (!before) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 })
    }

    if (action.data === 'undo') {
      if (!body.data.undoToken || body.data.version === undefined) {
        await client.query('ROLLBACK')
        return invalidRequestResponse('undo_token_required')
      }
      if (before.status === 'pending' || before.undo_token !== body.data.undoToken || before.decision_version !== body.data.version) {
        await client.query('ROLLBACK')
        return conflictResponse('undo_state_changed')
      }
      item = (await client.query<ReviewRow>(
        `UPDATE review_inbox
         SET status='pending',decided_by=NULL,decided_at=NULL,decision_notes=NULL,
             context=context-'snooze_until',decision_version=decision_version+1,
             undo_until=NULL,undo_token=NULL
         WHERE id=$1 AND status<>'pending' AND undo_token=$2 AND decision_version=$3 AND undo_until>now()
         RETURNING *`,
        [parsedId.data, body.data.undoToken, body.data.version],
      )).rows[0]!
      if (!item) {
        await client.query('ROLLBACK')
        return conflictResponse('undo_expired')
      }
      await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'review.undo',$2,$3,$4)`, [user.email, parsedId.data, before, item])
      await client.query('COMMIT')
      return NextResponse.json({ item, replay: false })
    }

    const reviewStatus = { approve: 'approved', edit: 'pending', reject: 'rejected', block: 'blocked', snooze: 'snoozed' }[action.data]
    if (before.status !== 'pending') {
      if (before.status === reviewStatus) {
        await client.query('ROLLBACK')
        return NextResponse.json({ item: before, replay: true })
      }
      await client.query('ROLLBACK')
      return conflictResponse('already_decided')
    }

    item = (await client.query<ReviewRow>(
      `UPDATE review_inbox
       SET status=$2,decided_by=$3,decided_at=CASE WHEN $2='pending' THEN NULL ELSE now() END,
           decision_notes=$4,suggested_action=COALESCE($5,suggested_action),
           context=CASE WHEN $6::text IS NULL THEN context ELSE context || jsonb_build_object('snooze_until',$6::text) END,
           decision_version=decision_version+1,
           undo_until=now()+$7::interval,undo_token=gen_random_uuid()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [parsedId.data, reviewStatus, user.email, body.data.notes ?? null, body.data.suggestedAction ? JSON.stringify(body.data.suggestedAction) : null, body.data.snoozeUntil ?? null, UNDO_WINDOW],
    )).rows[0]!
    if (!item) {
      await client.query('ROLLBACK')
      return conflictResponse('already_decided')
    }
    if (action.data === 'approve' && item.item_type === 'content_item' && item.item_ref_id) {
      await client.query(`UPDATE content_items SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1 AND status='draft'`, [item.item_ref_id, user.email])
    } else if (action.data === 'approve' && item.item_type === 'content_variant' && item.item_ref_id) {
      await client.query(`UPDATE content_variants SET status='approved',approved_by=$2 WHERE id=$1 AND status IN ('draft','ready')`, [item.item_ref_id, user.email])
    }
    await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4,$5)`, [user.email, `review.${action.data}`, parsedId.data, before, item])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }

  if (action.data !== 'approve') return NextResponse.json({ item })
  return NextResponse.json({
    item,
    orchestration: item.item_type === 'content_item'
      ? 'deferred_to_post_queue_runtime'
      : 'deferred_to_later_phase',
  })
}
