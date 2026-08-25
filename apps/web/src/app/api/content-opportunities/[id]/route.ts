import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Input = z.object({
  decision: z.enum(['approve', 'reject', 'update']),
  thesis: z.string().min(1).max(500).optional(), angle: z.string().max(1000).optional(), hook: z.string().max(1000).optional(),
}).strict()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('operator')
  const { id } = await params
  const parsed = Input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })) }, { status: 400 })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const before = (await client.query(`SELECT * FROM content_opportunities WHERE id=$1 FOR UPDATE`, [id])).rows[0]
    if (!before) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found' }, { status: 404 }) }
    if (parsed.data.decision === 'approve' && !['new', 'proposed'].includes(String(before.status))) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'already_decided', reasonCode: 'ALREADY_DONE' }, { status: 409 })
    }
    const status = parsed.data.decision === 'approve' ? 'approved' : parsed.data.decision === 'reject' ? 'rejected' : before.status
    const item = (await client.query(
      `UPDATE content_opportunities SET thesis=COALESCE($2,thesis),angle=COALESCE($3,angle),hook=COALESCE($4,hook),status=$5 WHERE id=$1 RETURNING *`,
      [id, parsed.data.thesis ?? null, parsed.data.angle ?? null, parsed.data.hook ?? null, status],
    )).rows[0]
    let contentItemId: string | undefined
    if (parsed.data.decision === 'approve') {
      const existing = await client.query<{ id: string }>('SELECT id FROM content_items WHERE opportunity_id=$1 ORDER BY created_at LIMIT 1', [id])
      contentItemId = existing.rows[0]?.id
      if (!contentItemId) {
        contentItemId = (await client.query<{ id: string }>(
          `INSERT INTO content_items(campaign_id,opportunity_id,audience_segment,funnel_stage,objective,angle,hook,arguments,cta,intelligence_sources,brand_voice_version,status,created_by)
           VALUES($1,$2,'prospects','awareness',$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,'current','draft',$9) RETURNING id`,
          [before.campaign_id, id, item.thesis, item.angle, item.hook, JSON.stringify([{ text: item.angle ?? item.thesis, evidence: item.evidence }]), JSON.stringify({ text: 'Salve e compartilhe com quem precisa.' }), JSON.stringify(item.source_references ?? []), user.email ?? 'unknown'],
        )).rows[0]!.id
        const baseCopy = [item.hook, item.angle, 'Salve para consultar depois.'].filter(Boolean).join('\n\n')
        await client.query(
          `INSERT INTO content_variants(content_item_id,channel,format,payload,status,generated_by)
           VALUES($1,'instagram','carousel',$2::jsonb,'draft','organic-draft-v1'),($1,'threads','text',$3::jsonb,'draft','organic-draft-v1')`,
          [contentItemId, JSON.stringify({ caption: baseCopy, slides: [{ role: 'cover', title: item.hook ?? item.thesis, body: item.angle ?? '' }, { role: 'content', title: item.thesis, body: item.angle ?? '' }, { role: 'cta', title: 'Próximo passo', body: 'Salve e compartilhe com quem precisa.' }] }), JSON.stringify({ text: baseCopy })],
        )
        await client.query(
          `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('content_item',$1,'Rascunho editorial gerado a partir de oportunidade aprovada',$2::jsonb,$3::jsonb)`,
          [contentItemId, JSON.stringify({ action: 'review_content_draft' }), JSON.stringify({ opportunityId: id, contentVersion: 1 })],
        )
      }
    }
    await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`, [user.email ?? 'unknown', `content_opportunity.${parsed.data.decision}`, id, JSON.stringify(before), JSON.stringify({ ...item, contentItemId })])
    await client.query('COMMIT')
    return NextResponse.json({ item, contentItemId })
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
