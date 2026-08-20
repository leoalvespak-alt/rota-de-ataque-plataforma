import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'
import { CommunityClient, type CommunityRow } from './CommunityClient'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const query = `SELECT community.id,community.name,community.size,community.cohesion_score "cohesionScore",count(DISTINCT membership.lead_id) FILTER (WHERE $1::uuid IS NULL OR EXISTS (SELECT 1 FROM lead_scores scoped_score WHERE scoped_score.lead_id=membership.lead_id AND scoped_score.campaign_id=$1))::int members,community.detected_at::text "detectedAt",community.last_refreshed_at::text "refreshedAt"
FROM communities community LEFT JOIN lead_community_membership membership ON membership.community_id=community.id
WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM lead_community_membership scoped_membership JOIN lead_scores scoped_score ON scoped_score.lead_id=scoped_membership.lead_id WHERE scoped_membership.community_id=community.id AND scoped_score.campaign_id=$1)) AND ($2::date IS NULL OR COALESCE(community.last_refreshed_at,community.detected_at) >= $2::date) AND ($3::date IS NULL OR COALESCE(community.last_refreshed_at,community.detected_at) < ($3::date + interval '1 day'))
GROUP BY community.id ORDER BY community.last_refreshed_at DESC NULLS LAST,community.id LIMIT $4 OFFSET $5`
const countQuery = `SELECT count(*)::int total FROM communities community WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM lead_community_membership scoped_membership JOIN lead_scores scoped_score ON scoped_score.lead_id=scoped_membership.lead_id WHERE scoped_membership.community_id=community.id AND scoped_score.campaign_id=$1)) AND ($2::date IS NULL OR COALESCE(community.last_refreshed_at,community.detected_at) >= $2::date) AND ($3::date IS NULL OR COALESCE(community.last_refreshed_at,community.detected_at) < ($3::date + interval '1 day'))`

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDataPageParams(await searchParams)
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
    const [result] = await Promise.all([pool.query<CommunityRow>(query, values), pool.query<{ total: number }>(countQuery, values.slice(0, 3))])
    return <CommunityClient data={result.rows.slice(0, DATA_PAGE_SIZE)} page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} campaignName={selected?.name ?? null} />
  } finally {}
}
