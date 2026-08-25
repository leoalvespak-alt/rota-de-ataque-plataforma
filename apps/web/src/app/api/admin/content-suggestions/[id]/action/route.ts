import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const Body = z.object({
  action: z.enum(['approve', 'edit-approve', 'reject']),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(10_000).optional(),
  rejectionReason: z.string().trim().min(1).max(2_000).optional(),
  scheduledFor: z.string().datetime().optional(),
}).strict().superRefine((value, context) => {
  if (value.action === 'reject' && !value.rejectionReason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['rejectionReason'], message: 'rejectionReason is required' })
})
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
    const suggestion = (await client.query<{
      id: string; title: string; description: string | null; pillar: string | null; campaign_id: string | null; thesis_id: string | null; suggested_format: string | null; suggested_channel: string | null; evidence: unknown; curation_status: 'proposed' | 'approved' | 'rejected' | 'expired'
    }>(`SELECT id,title,description,pillar,campaign_id,thesis_id,suggested_format,suggested_channel,evidence,curation_status FROM content_suggestions WHERE id=$1 FOR UPDATE`, [id.data])).rows[0]
    if (!suggestion) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 }) }
    if (suggestion.curation_status !== 'proposed') { await client.query('ROLLBACK'); return conflictResponse('already_decided') }

    if (parsed.data.action === 'reject') {
      const rejected = (await client.query(`UPDATE content_suggestions SET curation_status='rejected',rejection_reason=$2,updated_at=now() WHERE id=$1 RETURNING *`, [id.data, parsed.data.rejectionReason])).rows[0]
      await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'content_suggestion.reject',$2,$3,$4)`, [user.email ?? 'unknown', id.data, suggestion, rejected])
      await client.query('COMMIT')
      return NextResponse.json({ suggestionId: id.data, status: 'rejected' })
    }

    const title = parsed.data.action === 'edit-approve' ? parsed.data.title ?? suggestion.title : suggestion.title
    const description = parsed.data.action === 'edit-approve' ? parsed.data.description ?? suggestion.description : suggestion.description
    const opportunity = (await client.query<Record<string, unknown>>(
      `INSERT INTO content_opportunities(campaign_id,thesis,angle,hook,evidence,status,source_suggestion_id)
       VALUES($1,$2,$3,$4,$5::jsonb,'new',$6)
       ON CONFLICT (source_suggestion_id) WHERE source_suggestion_id IS NOT NULL
       DO UPDATE SET thesis=EXCLUDED.thesis,angle=EXCLUDED.angle,hook=EXCLUDED.hook,evidence=EXCLUDED.evidence
       RETURNING *`,
      [suggestion.campaign_id, title, description, title, JSON.stringify({ evidence: suggestion.evidence, suggestionId: id.data, format: suggestion.suggested_format, channel: suggestion.suggested_channel }), id.data],
    )).rows[0]
    const approved = (await client.query(`UPDATE content_suggestions SET title=$2,description=$3,curation_status='approved',approved_by=$4,approved_at=now(),opportunity_id=$5,updated_at=now() WHERE id=$1 RETURNING *`, [id.data, title, description, user.email ?? 'unknown', opportunity?.id])).rows[0]
    await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4,$5)`, [user.email ?? 'unknown', `content_suggestion.${parsed.data.action}`, id.data, suggestion, approved])
    await client.query('COMMIT')
    return NextResponse.json({ suggestionId: id.data, status: 'approved', opportunity })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
