import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ action: z.enum(['approve', 'dismiss']), scheduledFor: z.string().datetime().optional(), title: z.string().trim().min(1).max(180).optional(), caption: z.string().trim().min(1).max(4000).optional(), channel: z.enum(['instagram', 'threads']).optional(), campaignId: z.string().uuid().nullable().optional(), reason: z.string().trim().max(1000).optional() }).strict()
const Id = z.string().uuid()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = Body.safeParse(await request.json().catch(() => null))
  const id = Id.safeParse((await params).id)
  if (!parsed.success || !id.success) return invalidRequestResponse('invalid_request')

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const finding = (await client.query<{
      id: string; title: string; summary: string | null; pillar: string | null; action_status: 'pending' | 'approved' | 'dismissed'; promoted_publication_id: string | null; campaign_id: string | null
    }>(`SELECT id,title,summary,pillar,action_status,promoted_publication_id,campaign_id FROM radar_findings WHERE id=$1 FOR UPDATE`, [id.data])).rows[0]
    if (!finding) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 }) }

    if (finding.action_status !== 'pending') {
      if (parsed.data.action === 'approve' && finding.action_status === 'approved' && finding.promoted_publication_id) {
        const publication = (await client.query(`SELECT * FROM scheduled_publications WHERE id=$1`, [finding.promoted_publication_id])).rows[0] ?? null
        await client.query('ROLLBACK')
        return NextResponse.json({ findingId: id.data, status: 'approved', publication, replay: true })
      }
      if (parsed.data.action === 'dismiss' && finding.action_status === 'dismissed') {
        await client.query('ROLLBACK')
        return NextResponse.json({ findingId: id.data, status: 'dismissed', publication: null, replay: true })
      }
      await client.query('ROLLBACK')
      return conflictResponse('invalid_state')
    }

    let publication: Record<string, unknown> | null = null
    if (parsed.data.action === 'approve') {
      publication = (await client.query<Record<string, unknown>>(
        `INSERT INTO scheduled_publications(title,caption,channel,scheduled_for,status,pillar,origin,curation_status,campaign_id)
         VALUES($1,$2,$3,$4,'scheduled',$5,'automation','approved',$6) RETURNING *`,
        [parsed.data.title ?? finding.title, parsed.data.caption ?? finding.summary ?? finding.title, parsed.data.channel ?? 'instagram', parsed.data.scheduledFor ?? new Date(Date.now() + 60 * 60_000).toISOString(), finding.pillar, parsed.data.campaignId ?? finding.campaign_id],
      )).rows[0] ?? null
      await client.query(`UPDATE radar_findings SET processed=true,promoted_to_calendar=true,action_status='approved',promoted_publication_id=$2,updated_at=now() WHERE id=$1`, [id.data, publication?.id])
    } else {
      await client.query(`UPDATE radar_findings SET processed=true,action_status='dismissed',updated_at=now() WHERE id=$1`, [id.data])
    }
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,$2,$3,$4::jsonb)`, [user.email ?? 'unknown', `radar_finding.${parsed.data.action}`, id.data, JSON.stringify({ publicationId: publication?.id ?? null, reason: parsed.data.reason ?? null, campaignId: parsed.data.campaignId ?? finding.campaign_id })])
    await client.query('COMMIT')
    return NextResponse.json({ findingId: id.data, status: parsed.data.action === 'approve' ? 'approved' : 'dismissed', publication })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
