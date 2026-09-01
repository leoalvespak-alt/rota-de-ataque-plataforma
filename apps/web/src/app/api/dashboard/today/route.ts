import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  const traceId = crypto.randomUUID()
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const campaignId = selected?.id ?? null
    const [decisions, slots] = await Promise.all([
      pool.query<{ review: number; radar: number; suggestions: number }>(
        `SELECT
          (SELECT count(*)::int FROM review_inbox WHERE status='pending') review,
          (SELECT count(*)::int FROM radar_findings WHERE NOT processed AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL)) radar,
          (SELECT count(*)::int FROM content_opportunities WHERE status IN ('new','pending') AND ($1::uuid IS NULL OR campaign_id=$1)) suggestions`,
        [campaignId],
      ),
      pool.query<{ id: string; title: string; channel: string; scheduled_for: string }>(
        `SELECT id,COALESCE(title,caption,'Publicação') title,channel,scheduled_for::text
         FROM scheduled_publications_compat
         WHERE status IN ('approved','scheduled','planned')
           AND scheduled_for>=now() AND scheduled_for<now()+interval '24 hours'
           AND ($1::uuid IS NULL OR campaign_id=$1)
         ORDER BY scheduled_for`,
        [campaignId],
      ),
    ])
    const counts = decisions.rows[0] ?? { review: 0, radar: 0, suggestions: 0 }
    const actions = [
      counts.review + counts.radar > 0 ? { label: 'Revisar decisões editoriais', href: '/review-inbox' } : null,
      counts.suggestions > 0 ? { label: 'Revisar oportunidades de conteúdo', href: '/planejamento/oportunidades' } : null,
      { label: 'Acompanhar teses editoriais', href: '/planejamento/teses' },
    ].filter(Boolean) as Array<{ label: string; href: string }>

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      campaign: selected ? { id: selected.id, name: selected.name } : null,
      decisions: { review: counts.review, radar: counts.radar, insights: 0, suggestions: counts.suggestions, engagement: 0 },
      slots: slots.rows,
      engines: [],
      failedQueues: [],
      expiringTokens: [],
      actions,
      meta: { traceId, sourceStatus: 'ready' },
    })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {
    await pool.end()
  }
}
