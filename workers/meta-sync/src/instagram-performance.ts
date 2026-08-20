export interface InstagramPerformanceMetrics {
  impressions: number
  reach: number
  engagements: number
  saves: number
  shares: number
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>
}

function insightValue(insight: Record<string, unknown>) {
  const values = Array.isArray(insight.values) ? insight.values as Array<Record<string, unknown>> : []
  const total = insight.total_value as Record<string, unknown> | undefined
  return Number(values[0]?.value ?? total?.value ?? insight.value ?? 0)
}

export function normalizeInstagramInsights(
  insights: Record<string, unknown>[],
  fallback: { likes?: number; comments?: number } = {},
): InstagramPerformanceMetrics {
  const metrics = Object.fromEntries(insights.map((insight) => [String(insight.name), insightValue(insight)])) as Record<string, number>
  const saves = metrics.saved ?? metrics.saves ?? 0
  const shares = metrics.shares ?? 0
  return {
    impressions: metrics.impressions ?? metrics.views ?? 0,
    reach: metrics.reach ?? 0,
    engagements: metrics.total_interactions ?? Number(fallback.likes ?? 0) + Number(fallback.comments ?? 0) + saves + shares,
    saves,
    shares,
  }
}

export async function upsertInstagramPerformance(database: Queryable, mediaId: string, metrics: InstagramPerformanceMetrics) {
  await database.query(
    `WITH published AS (
       SELECT publication.id,publication.variant_id,publication.published_at,
         CASE WHEN now()-publication.published_at<=interval '2 hours' THEN '1h'
              WHEN now()-publication.published_at<=interval '12 hours' THEN '6h'
              WHEN now()-publication.published_at<=interval '48 hours' THEN '24h'
              WHEN now()-publication.published_at<=interval '120 hours' THEN '72h' ELSE '7d' END metric_window
       FROM content_publications publication WHERE publication.channel='instagram' AND publication.external_id=$1
     ), snapshot AS (
       INSERT INTO publication_metric_snapshots(publication_id,variant_id,channel,metric_window,metrics,source)
       SELECT id,variant_id,'instagram',metric_window,jsonb_build_object('impressions',$2::int,'reach',$3::int,'engagements',$4::int,'saves',$5::int,'shares',$6::int),'meta' FROM published
       ON CONFLICT(publication_id,metric_window) DO UPDATE SET metrics=EXCLUDED.metrics,captured_at=now() RETURNING variant_id
     )
     INSERT INTO content_performance(variant_id, channel, impressions, reach, engagements, saves, shares)
     SELECT variant_id, 'instagram', $2, $3, $4, $5, $6 FROM published
     ON CONFLICT (variant_id) DO UPDATE SET
       impressions = GREATEST(content_performance.impressions, EXCLUDED.impressions),
       reach       = GREATEST(content_performance.reach,       EXCLUDED.reach),
       engagements = GREATEST(content_performance.engagements, EXCLUDED.engagements),
       saves       = GREATEST(content_performance.saves,       EXCLUDED.saves),
       shares      = GREATEST(content_performance.shares,      EXCLUDED.shares),
       computed_at = now()`,
    [mediaId, metrics.impressions, metrics.reach, metrics.engagements, metrics.saves, metrics.shares],
  )
}
