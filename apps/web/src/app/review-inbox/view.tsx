import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ReviewInboxClient } from './ReviewInboxClient'

export default async function ReviewInboxPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const [items, stats, radarFindings, competitorInsights, contentSuggestions] = await Promise.all([
      pool.query(`SELECT id,item_type,reason,suggested_action,context,created_at,decision_version,undo_token,undo_until FROM review_inbox WHERE (status='pending' OR (status='snoozed' AND COALESCE(context->>'snooze_until','') <= now()::text)) AND ($1::uuid IS NULL OR context->>'campaignId'=$1::text) ORDER BY created_at ASC LIMIT 200`, [selected?.id ?? null]),
      pool.query<{ count:string }>(`SELECT COUNT(*)::text count FROM review_inbox WHERE decided_at::date=CURRENT_DATE AND ($1::uuid IS NULL OR context->>'campaignId'=$1::text)`, [selected?.id ?? null]),
      pool.query(`SELECT id, title, summary, source_url, source_name, concurso_alvo, estado, banca, fase_ciclo, relevance_score, created_at, campaign_id FROM radar_findings WHERE NOT processed AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL) ORDER BY relevance_score DESC, created_at DESC LIMIT 50`, [selected?.id ?? null]),
      pool.query(`SELECT id, competitor_handle, insight_type, title, description, hypothesis, evidence, metrics, is_outlier, outlier_multiplier, created_at FROM competitor_insights WHERE NOT processed AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL) ORDER BY is_outlier DESC, created_at DESC LIMIT 50`, [selected?.id ?? null]),
      pool.query(`SELECT id, source_type, title, description, suggested_format, suggested_channel, pillar, evidence, thesis_id, campaign_id, curation_status, created_at FROM content_suggestions WHERE curation_status = 'proposed' AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL) ORDER BY created_at DESC LIMIT 50`, [selected?.id ?? null]),
    ])
    return (
      <ReviewInboxClient
        initialItems={items.rows}
        decidedToday={Number(stats.rows[0]?.count ?? 0)}
        radarFindings={JSON.parse(JSON.stringify(radarFindings.rows))}
        competitorInsights={JSON.parse(JSON.stringify(competitorInsights.rows))}
        contentSuggestions={JSON.parse(JSON.stringify(contentSuggestions.rows))}
      />
    )
  } finally {}
}
