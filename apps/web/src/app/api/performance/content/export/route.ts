import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

function csv(value: unknown): string { const text = value === null || value === undefined ? '' : String(value); return `"${text.replace(/"/gu, '""')}"` }

export async function GET(request: Request) {
  try {
    await requireRole('viewer')
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if ((from && !/^\d{4}-\d{2}-\d{2}$/u.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/u.test(to))) return NextResponse.json({ error: 'invalid_date_filter' }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const { selected } = await getCampaignContext(pool)
    const result = await pool.query(`SELECT variant.id variant_id,COALESCE(thesis.title,'Sem tese') thesis,COALESCE(item.hook,'Sem título') content_title,variant.channel,variant.format,performance.impressions,performance.engagements,performance.clicks,performance.conversions,performance.computed_at
      FROM content_performance performance JOIN content_variants variant ON variant.id=performance.variant_id JOIN content_items item ON item.id=variant.content_item_id LEFT JOIN theses thesis ON thesis.id=item.thesis_id
      WHERE ($1::uuid IS NULL OR item.campaign_id=$1) AND ($2::date IS NULL OR performance.computed_at >= $2::date) AND ($3::date IS NULL OR performance.computed_at < ($3::date + interval '1 day')) ORDER BY performance.conversions DESC,performance.engagements DESC,performance.computed_at DESC,variant.id`, [selected?.id ?? null, from, to])
    const fields = ['variant_id', 'thesis', 'content_title', 'channel', 'format', 'impressions', 'engagements', 'clicks', 'conversions', 'computed_at']
    const rows = result.rows.map((row: Record<string, unknown>) => fields.map((field) => csv(row[field])).join(','))
    return new Response([fields.join(','), ...rows].join('\n') + '\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="content-performance.csv"' } })
  } catch (error) { return apiErrorResponse(error) }
}
