import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'
import { SourceRoiClient, type SourceRoiRow } from './SourceRoiClient'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const query = `SELECT metric.id,metric.source_type "sourceType",metric.source_id "sourceId",metric.window_days "windowDays",metric.unique_leads "uniqueLeads",metric.followback_rate "followbackRate",metric.retention_7d_rate "retention7dRate",CASE WHEN COALESCE(metric.unique_leads,0)>0 THEN metric.conversion_rate ELSE NULL END "conversionRate",metric.source_score "sourceScore",metric.computed_at::text "computedAt"
FROM source_metrics metric WHERE ($1::uuid IS NULL OR metric.campaign_id=$1) AND ($2::date IS NULL OR metric.computed_at >= $2::date) AND ($3::date IS NULL OR metric.computed_at < ($3::date + interval '1 day'))
ORDER BY metric.source_score DESC NULLS LAST,metric.computed_at DESC,metric.id LIMIT $4 OFFSET $5`
const countQuery = `SELECT count(*)::int total FROM source_metrics metric WHERE ($1::uuid IS NULL OR metric.campaign_id=$1) AND ($2::date IS NULL OR metric.computed_at >= $2::date) AND ($3::date IS NULL OR metric.computed_at < ($3::date + interval '1 day'))`
const freshnessQuery = `SELECT max(metric.computed_at)::text "freshness" FROM source_metrics metric WHERE ($1::uuid IS NULL OR metric.campaign_id=$1) AND ($2::date IS NULL OR metric.computed_at >= $2::date) AND ($3::date IS NULL OR metric.computed_at < ($3::date + interval '1 day'))`

export default async function SourceRoiPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDataPageParams(await searchParams)
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
    const [result, totalResult, freshnessResult] = await Promise.all([pool.query<SourceRoiRow>(query, values), pool.query<{ total: number }>(countQuery, values.slice(0, 3)), pool.query<{ freshness: string | null }>(freshnessQuery, values.slice(0, 3))])
    return <SourceRoiClient data={result.rows.slice(0, DATA_PAGE_SIZE)} page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} campaignName={selected?.name ?? null} total={Number(totalResult.rows[0]?.total ?? 0)} freshness={freshnessResult.rows[0]?.freshness ?? null} />
  } finally {}
}
