import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

type FunnelRow = {
  stage: string
  id: string
  title: string
  status: string
  entered_at: string
  age_hours: number
  locked: boolean
  source_id: string | null
  next_id: string | null
  provenance: 'linked' | 'pending' | 'manual' | 'orphan'
}

export async function GET() {
  const traceId = crypto.randomUUID()
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const result = await pool.query<FunnelRow>(`WITH funnel AS (
      SELECT 'suggestions' stage,suggestion.id,COALESCE(suggestion.title,'Sugestão') title,suggestion.curation_status status,suggestion.created_at entered_at,false locked,suggestion.source_id,(SELECT opportunity.id FROM content_opportunities opportunity WHERE opportunity.source_suggestion_id=suggestion.id LIMIT 1) next_id FROM content_suggestions suggestion WHERE ($1::uuid IS NULL OR suggestion.campaign_id=$1 OR suggestion.campaign_id IS NULL)
      UNION ALL SELECT 'opportunities',opportunity.id,COALESCE(opportunity.hook,opportunity.thesis,'Oportunidade'),opportunity.status,opportunity.created_at,false,opportunity.source_suggestion_id,(SELECT item.id FROM content_items item WHERE item.opportunity_id=opportunity.id ORDER BY item.created_at LIMIT 1) FROM content_opportunities opportunity WHERE ($1::uuid IS NULL OR opportunity.campaign_id=$1)
      UNION ALL SELECT 'items',item.id,COALESCE(item.hook,item.angle,'Conteúdo'),item.status,item.created_at,(item.locked_at IS NOT NULL),item.opportunity_id,(SELECT variant.id FROM content_variants variant WHERE variant.content_item_id=item.id ORDER BY variant.created_at LIMIT 1) FROM content_items item WHERE ($1::uuid IS NULL OR item.campaign_id=$1)
      UNION ALL SELECT 'variants',variant.id,COALESCE(variant.payload->>'caption',item.hook,variant.format),variant.status,variant.created_at,(variant.locked_at IS NOT NULL),variant.content_item_id,(SELECT publication.id FROM scheduled_publications publication WHERE publication.variant_id=variant.id ORDER BY publication.scheduled_for NULLS LAST,publication.published_at NULLS LAST LIMIT 1) FROM content_variants variant JOIN content_items item ON item.id=variant.content_item_id WHERE ($1::uuid IS NULL OR item.campaign_id=$1)
      UNION ALL SELECT 'publications',publication.id,COALESCE(publication.title,publication.caption,'Publicação'),publication.status,COALESCE(publication.scheduled_for,publication.published_at,now()),(publication.locked_at IS NOT NULL),publication.thesis_id,NULL::uuid FROM scheduled_publications_compat publication WHERE ($1::uuid IS NULL OR publication.campaign_id=$1)
    ), enriched AS (
      SELECT funnel.*,CASE WHEN stage='publications' AND source_id IS NULL THEN 'manual' WHEN (stage='suggestions' AND next_id IS NOT NULL) OR (stage='opportunities' AND (source_id IS NOT NULL OR next_id IS NOT NULL)) OR (stage='items' AND (source_id IS NOT NULL OR next_id IS NOT NULL)) OR (stage='variants' AND (source_id IS NOT NULL OR next_id IS NOT NULL)) OR (stage='publications' AND source_id IS NOT NULL) THEN 'linked' WHEN status IN ('approved','scheduled','published','producing') THEN 'orphan' ELSE 'pending' END provenance FROM funnel
    ) SELECT stage,id,title,status,entered_at::text,round(extract(epoch FROM (now()-entered_at))/3600)::int age_hours,locked,source_id,next_id,provenance FROM enriched ORDER BY entered_at DESC`, [selected?.id ?? null])
    const stages = ['suggestions', 'opportunities', 'items', 'variants', 'publications'].map((stage) => {
      const items = result.rows.filter((item) => item.stage === stage)
      const averageDwellHours = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.age_hours), 0) / items.length) : 0
      return { stage, count: items.length, averageDwellHours, stuck: items.filter((item) => item.locked || item.provenance === 'orphan' || Number(item.age_hours) >= 168).length, items: items.slice(0, 100) }
    })
    return NextResponse.json({ generatedAt: new Date().toISOString(), stages, meta: { traceId, sourceStatus: 'ready', campaignId: selected?.id ?? null } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
