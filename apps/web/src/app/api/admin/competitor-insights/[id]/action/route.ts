import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, conflictResponse, invalidRequestResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ action: z.enum(['generate-suggestion', 'mark-seen']) }).strict()
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
    const insight = (await client.query<{
      id: string; title: string; description: string | null; pillar: string | null; hypothesis: string | null; evidence: unknown; action_status: 'pending' | 'seen' | 'suggestion_created'
    }>(`SELECT id,title,description,pillar,hypothesis,evidence,action_status FROM competitor_insights WHERE id=$1 FOR UPDATE`, [id.data])).rows[0]
    if (!insight) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 }) }

    const existing = (await client.query(`SELECT * FROM content_suggestions WHERE source_type='competitor' AND source_id=$1`, [id.data])).rows[0] ?? null
    if (insight.action_status === 'suggestion_created' || existing) {
      await client.query('ROLLBACK')
      return NextResponse.json({ insightId: id.data, status: 'suggestion_created', suggestion: existing, replay: true })
    }
    if (parsed.data.action === 'mark-seen' && insight.action_status === 'seen') {
      await client.query('ROLLBACK')
      return NextResponse.json({ insightId: id.data, status: 'seen', suggestion: null, replay: true })
    }

    let suggestion: Record<string, unknown> | null = null
    const nextStatus = parsed.data.action === 'generate-suggestion' ? 'suggestion_created' : 'seen'
    if (parsed.data.action === 'generate-suggestion') {
      suggestion = (await client.query<Record<string, unknown>>(
        `INSERT INTO content_suggestions(source_type,source_id,title,description,suggested_format,suggested_channel,pillar,evidence)
         VALUES('competitor',$1,$2,$3,'carousel','instagram',$4,$5::jsonb) RETURNING *`,
        [id.data, insight.title, insight.description, insight.pillar, JSON.stringify({ insightId: id.data, hypothesis: insight.hypothesis, evidence: insight.evidence })],
      )).rows[0] ?? null
    }
    await client.query(`UPDATE competitor_insights SET processed=true,action_status=$2 WHERE id=$1`, [id.data, nextStatus])
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,$2,$3,$4::jsonb)`, [user.email ?? 'unknown', `competitor_insight.${parsed.data.action}`, id.data, JSON.stringify({ suggestionId: suggestion?.id ?? null })])
    await client.query('COMMIT')
    return NextResponse.json({ insightId: id.data, status: nextStatus, suggestion })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
