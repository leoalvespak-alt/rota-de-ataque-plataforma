import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { CancelPublicationSchema } from '@/lib/admin-publishing-schemas'
import { isPublicationCancellable } from '@/lib/organic-actions'
import { requireRole } from '@/lib/permissions'

const CANCEL_WINDOW_MINUTES = 10

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = CancelPublicationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse('invalid_request')

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pub = (await client.query<{ id: string; status: string; scheduled_for: string | null }>(
      `SELECT id,status,scheduled_for FROM unified_creatives WHERE id=$1 FOR UPDATE`,
      [parsed.data.publicationId],
    )).rows[0]
    if (!pub) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 }) }
    if (pub.status === 'published') { await client.query('ROLLBACK'); return conflictResponse('already_published') }
    if (pub.status === 'cancelled') { await client.query('ROLLBACK'); return conflictResponse('already_cancelled') }
    if (!isPublicationCancellable(pub.status)) { await client.query('ROLLBACK'); return conflictResponse('invalid_state') }

    const scheduledFor = pub.scheduled_for ? new Date(pub.scheduled_for) : null
    const now = new Date()
    if (!scheduledFor || Number.isNaN(scheduledFor.getTime()) || now > scheduledFor) { await client.query('ROLLBACK'); return conflictResponse('publication_window_passed') }
    const windowStart = new Date(scheduledFor.getTime() - CANCEL_WINDOW_MINUTES * 60_000)
    if (now < windowStart) { await client.query('ROLLBACK'); return conflictResponse('cancellation_window_not_open') }
    await client.query(`UPDATE unified_creatives SET status='cancelled',error=$2 WHERE id=$1`, [parsed.data.publicationId, parsed.data.reason])
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'publication.cancelled',$2,$3::jsonb)`, [user.email ?? 'unknown', parsed.data.publicationId, JSON.stringify({ reason: parsed.data.reason, cancelledAt: now.toISOString(), wasInWindow: now >= windowStart })])
    await client.query('COMMIT')
    return NextResponse.json({ cancelled: true, wasInWindow: now >= windowStart })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
