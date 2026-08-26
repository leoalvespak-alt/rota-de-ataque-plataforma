import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

function csv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/gu, '""')}"`
}

export async function GET(request: Request) {
  try {
    await requireRole('viewer')
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if ((from && !/^\d{4}-\d{2}-\d{2}$/u.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/u.test(to))) return NextResponse.json({ error: 'invalid_date_filter' }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const { selected } = await getCampaignContext(pool)
    const result = await pool.query(`SELECT metric.source_type,metric.source_id,metric.window_days,metric.unique_leads,metric.followback_rate,metric.retention_7d_rate,metric.conversion_rate,metric.source_score,metric.computed_at
      FROM source_metrics metric WHERE ($1::uuid IS NULL OR metric.campaign_id=$1) AND ($2::date IS NULL OR metric.computed_at >= $2::date) AND ($3::date IS NULL OR metric.computed_at < ($3::date + interval '1 day'))
      ORDER BY metric.source_score DESC NULLS LAST,metric.computed_at DESC,metric.id`, [selected?.id ?? null, from, to])
    const header = ['source_type', 'source_id', 'window_days', 'unique_leads', 'followback_rate', 'retention_7d_rate', 'conversion_rate', 'source_score', 'computed_at']
    const body = result.rows.map((row: Record<string, unknown>) => header.map((key) => csv(row[key])).join(','))
    return new Response([header.join(','), ...body].join('\n') + '\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="source-roi.csv"' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
