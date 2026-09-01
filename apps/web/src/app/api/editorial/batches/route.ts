import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const Input = z.object({
  startsOn: z.string().date().optional(),
  evergreenLimit: z.number().int().min(1).max(15).default(8),
  radarLimit: z.number().int().min(0).max(15).default(7),
}).strict()

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  try {
    const user = await requireRole('operator')
    const parsed = Input.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return invalidRequestResponse()
    const startsOn = parsed.data.startsOn ?? new Date().toISOString().slice(0, 10)
    const endsOn = addDays(startsOn, 14)
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const { selected } = await getCampaignContext(client)
      if (!selected) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'campaign_not_found' }, { status: 409 }) }

      const batch = (await client.query<{ id: string; status: string }>(
        `INSERT INTO editorial_batches(campaign_id,cycle_days,starts_on,ends_on,status,source_mix,created_by)
         VALUES($1,15,$2,$3,'draft','{}'::jsonb,$4)
         ON CONFLICT(campaign_id,starts_on) DO UPDATE SET ends_on=EXCLUDED.ends_on
         RETURNING id,status`,
        [selected.id, startsOn, endsOn, user.email ?? 'unknown'],
      )).rows[0]!

      const radar = (await client.query<{ id: string; title: string; thesis: string; angle: string | null; hook: string | null; evidence: unknown; source_references: unknown; confidence: number }>(
        `SELECT id,COALESCE(hook,thesis) title,thesis,angle,hook,evidence,source_references,confidence
         FROM content_opportunities
         WHERE campaign_id=$1 AND status IN ('new','proposed')
           AND NOT EXISTS (SELECT 1 FROM content_items item WHERE item.opportunity_id=content_opportunities.id AND item.status NOT IN ('archived'))
         ORDER BY opportunity_score DESC,created_at ASC LIMIT $2`,
        [selected.id, parsed.data.radarLimit],
      )).rows
      const theses = (await client.query<{ id: string; title: string; description: string | null }>(
        `SELECT id,title,description FROM theses WHERE campaign_id=$1 AND active=true ORDER BY locked_at NULLS LAST,created_at ASC LIMIT $2`,
        [selected.id, parsed.data.evergreenLimit],
      )).rows

      let created = 0
      for (const [position, candidate] of [...radar.map(item => ({ kind: 'radar' as const, item })), ...theses.map(item => ({ kind: 'evergreen' as const, item }))].entries()) {
        const isRadar = candidate.kind === 'radar'
        const item = candidate.item
        const hook = isRadar ? (item.hook ?? item.title) : `Evergreen · ${item.title}`
        const angle = isRadar ? (item.angle ?? item.thesis) : (item.description ?? item.title)
        const title = isRadar ? item.title : item.title
        const inserted = (await client.query<{ id: string }>(
          `INSERT INTO content_items(batch_id,campaign_id,opportunity_id,thesis_id,audience_segment,funnel_stage,objective,angle,hook,arguments,cta,intelligence_sources,brand_voice_version,status,created_by)
           VALUES($1,$2,$3,$4,'candidatos de concursos policiais','awareness','planejamento editorial de 15 dias',$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'editorial-15d-v1','draft',$10)
           ON CONFLICT DO NOTHING RETURNING id`,
          [batch.id, selected.id, isRadar ? item.id : null, isRadar ? null : item.id, angle, hook, JSON.stringify([{ role: 'brief', text: angle }]), JSON.stringify({ text: 'Salve para revisar' }), JSON.stringify({ source: isRadar ? 'radar' : 'evergreen', planned_for: addDays(startsOn, position % 15), evidence: isRadar ? item.evidence : {}, references: isRadar ? item.source_references : [] }), user.email ?? 'unknown'],
        )).rows[0]
        const contentItemId = inserted?.id ?? (await client.query<{ id: string }>('SELECT id FROM content_items WHERE batch_id=$1 AND hook=$2 LIMIT 1', [batch.id, hook])).rows[0]?.id
        if (!contentItemId) continue
        await client.query(
          `INSERT INTO content_variants(content_item_id,channel,format,payload,status,generated_by)
           VALUES($1,'instagram','carousel',$2::jsonb,'draft','editorial-15d-v1'),($1,'threads','text',$3::jsonb,'draft','editorial-15d-v1')
           ON CONFLICT(content_item_id,channel,format) DO NOTHING`,
          [contentItemId, JSON.stringify({ brief: angle, headline: title, caption: angle, cta: 'Salve para revisar', planned_for: addDays(startsOn, position % 15) }), JSON.stringify({ brief: angle, text: `${title}\n\n${angle}` })],
        )
        await client.query(
          `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context)
           SELECT 'content_item',$1,'Lote editorial de 15 dias aguardando aprovação humana',$2::jsonb,$3::jsonb
           WHERE NOT EXISTS (SELECT 1 FROM review_inbox WHERE item_type='content_item' AND item_ref_id=$1 AND status='pending')`,
          [contentItemId, JSON.stringify({ actions: ['approve', 'reject', 'edit', 'reschedule'] }), JSON.stringify({ batchId: batch.id, source: isRadar ? 'radar' : 'evergreen' })],
        )
        created++
      }
      await client.query(`UPDATE editorial_batches SET source_mix=$2::jsonb,status='in_review' WHERE id=$1`, [batch.id, JSON.stringify({ radar: radar.length, evergreen: theses.length, created, cycleDays: 15 })])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'editorial_batch.created',$2,$3::jsonb)`, [user.email ?? 'unknown', batch.id, JSON.stringify({ startsOn, endsOn, created })])
      await client.query('COMMIT')
      return NextResponse.json({ batchId: batch.id, startsOn, endsOn, created, radarCandidates: radar.length, evergreenCandidates: theses.length }, { status: 201 })
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  } catch (error) { return apiErrorResponse(error) }
}

export async function GET() {
  try {
    await requireRole('operator')
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const result = await pool.query(`SELECT id,campaign_id,cycle_days,starts_on,ends_on,status,source_mix,created_at FROM editorial_batches ORDER BY starts_on DESC LIMIT 30`)
    return NextResponse.json({ batches: result.rows })
  } catch (error) { return apiErrorResponse(error) }
}
