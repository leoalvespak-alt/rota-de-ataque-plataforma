import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  await requireRole('operator')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const [radarStats, suggestionStats, calendarAdherence, radarLatency] = await Promise.all([
      pool.query(`SELECT source_name, COUNT(*) items, COUNT(*) FILTER (WHERE relevance_score >= 0.7) high_relevance
        FROM radar_findings WHERE created_at >= now() - interval '7 days' GROUP BY source_name ORDER BY items DESC`),

      pool.query(`SELECT curation_status, COUNT(*) count FROM content_suggestions
        WHERE created_at >= now() - interval '30 days' GROUP BY curation_status`),

      pool.query(`SELECT p.slug pillar, cp.weekly_weight target_weight,
          COUNT(sp.id) FILTER (WHERE sp.scheduled_for >= date_trunc('week', now())) actual_this_week,
          ROUND(COUNT(sp.id) FILTER (WHERE sp.scheduled_for >= date_trunc('week', now()))::numeric /
            NULLIF(COUNT(sp.id) FILTER (WHERE sp.scheduled_for >= date_trunc('week', now()) - interval '1 week' AND sp.scheduled_for < date_trunc('week', now())), 0) * 100) wow_pct
        FROM content_pillars cp
        LEFT JOIN scheduled_publications sp ON sp.pillar = cp.slug AND sp.status NOT IN ('cancelled', 'failed')
        CROSS JOIN LATERAL (SELECT cp.slug) p(slug)
        WHERE cp.active GROUP BY p.slug, cp.weekly_weight ORDER BY cp.weekly_weight DESC`),

      pool.query(`SELECT ROUND(EXTRACT(EPOCH FROM AVG(rf.created_at - ni.published_at)) / 3600) avg_latency_hours
        FROM radar_findings rf JOIN news_items ni ON ni.id = rf.news_item_id
        WHERE rf.created_at >= now() - interval '7 days' AND ni.published_at IS NOT NULL`),
    ])

    const proposed = suggestionStats.rows.find((r: any) => r.curation_status === 'proposed')
    const accepted = suggestionStats.rows.find((r: any) => r.curation_status === 'accepted')
    const rejected = suggestionStats.rows.find((r: any) => r.curation_status === 'rejected')
    const totalDecided = Number(accepted?.count ?? 0) + Number(rejected?.count ?? 0)
    const approvalRate = totalDecided > 0 ? Math.round((Number(accepted?.count ?? 0) / totalDecided) * 100) : null

    return NextResponse.json({
      radar: {
        bySource: radarStats.rows,
        latencyHours: radarLatency.rows[0]?.avg_latency_hours ?? null,
      },
      suggestions: {
        pending: Number(proposed?.count ?? 0),
        accepted: Number(accepted?.count ?? 0),
        rejected: Number(rejected?.count ?? 0),
        approvalRate,
      },
      calendar: {
        pillarAdherence: calendarAdherence.rows,
      },
    })
  } finally {}
}
