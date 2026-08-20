import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'
import { RadarClient, type RadarRow } from './RadarClient'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const query = `SELECT rf.id,rf.title,rf.source_name "sourceName",rf.source_url "sourceUrl",rf.relevance_score::float "relevanceScore",rf.fase_ciclo phase,CASE WHEN rf.processed THEN 'Processado' ELSE 'Pendente' END processed,ni.published_at::text "publishedAt",rf.created_at::text "createdAt"
FROM radar_findings rf LEFT JOIN news_items ni ON ni.id=rf.news_item_id
WHERE ($1::uuid IS NULL OR rf.campaign_id=$1 OR rf.campaign_id IS NULL) AND ($2::date IS NULL OR rf.created_at >= $2::date) AND ($3::date IS NULL OR rf.created_at < ($3::date + interval '1 day'))
ORDER BY rf.relevance_score DESC NULLS LAST,rf.created_at DESC,rf.id DESC LIMIT $4 OFFSET $5`
const countQuery = `SELECT count(*)::int total FROM radar_findings rf WHERE ($1::uuid IS NULL OR rf.campaign_id=$1 OR rf.campaign_id IS NULL) AND ($2::date IS NULL OR rf.created_at >= $2::date) AND ($3::date IS NULL OR rf.created_at < ($3::date + interval '1 day'))`

export default async function RadarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDataPageParams(await searchParams)
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
    const [result] = await Promise.all([pool.query<RadarRow>(query, values), pool.query<{ total: number }>(countQuery, values.slice(0, 3))])
    return <RadarClient data={result.rows.slice(0, DATA_PAGE_SIZE)} page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} campaignName={selected?.name ?? null} />
  } finally {}
}
