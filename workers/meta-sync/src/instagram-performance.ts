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
    `INSERT INTO content_performance(variant_id, channel, impressions, reach, engagements, saves, shares)
     SELECT publication.variant_id, 'instagram', $2, $3, $4, $5, $6
     FROM content_publications publication
     WHERE publication.channel = 'instagram' AND publication.external_id = $1
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
