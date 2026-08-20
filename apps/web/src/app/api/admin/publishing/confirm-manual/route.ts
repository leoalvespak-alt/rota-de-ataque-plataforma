import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { ConfirmManualPublicationSchema } from '@/lib/admin-publishing-schemas'
import { isManualConfirmationAllowed } from '@/lib/organic-actions'
import { requireRole } from '@/lib/permissions'

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = ConfirmManualPublicationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse('invalid_request')

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pub = (await client.query<{ id: string; status: string }>(`SELECT id,status FROM scheduled_publications WHERE id=$1 FOR UPDATE`, [parsed.data.publicationId])).rows[0]
    if (!pub) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 }) }
    if (pub.status === 'published') { await client.query('ROLLBACK'); return conflictResponse('already_published') }
    if (!isManualConfirmationAllowed(pub.status)) { await client.query('ROLLBACK'); return conflictResponse('invalid_state') }

    await client.query(`UPDATE scheduled_publications SET status='published',published_at=now(),ig_media_id=$2,error=NULL WHERE id=$1`, [parsed.data.publicationId, parsed.data.externalId])
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'publication.confirmed_manual',$2,$3::jsonb)`, [user.email ?? 'unknown', parsed.data.publicationId, JSON.stringify({ externalId: parsed.data.externalId, confirmedAt: new Date().toISOString() })])
    await client.query('COMMIT')
    return NextResponse.json({ confirmed: true })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
