import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'
import { CompetitiveIntelClient, type CompetitiveIntelRow } from './CompetitiveIntelClient'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const rowsQuery = `WITH organic_rows AS (
  SELECT ci.id, 'insight'::text kind, 'competitor_insight'::text origin, ci.competitor_handle competitor, ci.title, ci.description,
         CASE WHEN ci.processed THEN 'processed' ELSE ci.action_status END curation_state,
         ci.evidence->>'url' evidence_url, ci.created_at
    FROM competitor_insights ci
   WHERE ($1::uuid IS NULL OR ci.campaign_id=$1 OR (ci.campaign_id IS NULL AND EXISTS (
     SELECT 1 FROM campaign_competitors cc JOIN competitors c ON c.id=cc.competitor_id
      WHERE cc.campaign_id=$1 AND cc.status='active' AND lower(regexp_replace(c.username,'^@',''))=lower(regexp_replace(ci.competitor_handle,'^@','')))))
  UNION ALL
  SELECT cs.id, 'suggestion'::text kind, 'content_suggestion'::text origin, COALESCE(ci.competitor_handle,'—') competitor, cs.title, cs.description,
         cs.curation_status curation_state, cs.evidence->>'url' evidence_url, cs.created_at
    FROM content_suggestions cs LEFT JOIN competitor_insights ci ON ci.id=cs.source_id
   WHERE cs.source_type='competitor' AND ($1::uuid IS NULL OR cs.campaign_id=$1 OR (cs.campaign_id IS NULL AND ci.campaign_id=$1))
)
SELECT id,kind,origin,competitor,title,description,curation_state,evidence_url,created_at::text "createdAt"
  FROM organic_rows
 WHERE ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < ($3::date + interval '1 day'))
 ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`

const countQuery = `WITH organic_rows AS (
  SELECT ci.id, ci.created_at FROM competitor_insights ci WHERE ($1::uuid IS NULL OR ci.campaign_id=$1 OR (ci.campaign_id IS NULL AND EXISTS (SELECT 1 FROM campaign_competitors cc JOIN competitors c ON c.id=cc.competitor_id WHERE cc.campaign_id=$1 AND cc.status='active' AND lower(regexp_replace(c.username,'^@',''))=lower(regexp_replace(ci.competitor_handle,'^@','')))))
  UNION ALL
  SELECT cs.id, cs.created_at FROM content_suggestions cs LEFT JOIN competitor_insights ci ON ci.id=cs.source_id WHERE cs.source_type='competitor' AND ($1::uuid IS NULL OR cs.campaign_id=$1 OR (cs.campaign_id IS NULL AND ci.campaign_id=$1))
) SELECT count(*)::int total FROM organic_rows WHERE ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < ($3::date + interval '1 day'))`

export default async function CompetitiveIntelPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDataPageParams(await searchParams)
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
    const [result, count] = await Promise.all([pool.query<CompetitiveIntelRow>(rowsQuery, values), pool.query<{ total: number }>(countQuery, values.slice(0, 3))])
    return <CompetitiveIntelClient data={result.rows.slice(0, DATA_PAGE_SIZE)} page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} campaignName={selected?.name ?? null} />
  } finally {}
}
