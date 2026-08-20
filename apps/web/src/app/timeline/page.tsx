import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { DATA_PAGE_SIZE, pageOffset, parseDataPageParams } from '@/lib/data-page'
import { TimelineClient, type TimelineRow } from './TimelineClient'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const query = `SELECT event.id,lead.username_current lead,event.channel,event.event_type "eventType",event.at::text, event.source,event.metadata->>'correlation_id' correlation,event.campaign_id::text campaign
FROM timeline_events event LEFT JOIN leads lead ON lead.id=event.lead_id
WHERE ($1::uuid IS NULL OR event.campaign_id=$1) AND ($2::date IS NULL OR event.at >= $2::date) AND ($3::date IS NULL OR event.at < ($3::date + interval '1 day'))
ORDER BY event.at DESC,event.id DESC LIMIT $4 OFFSET $5`
const countQuery = `SELECT count(*)::int total FROM timeline_events event WHERE ($1::uuid IS NULL OR event.campaign_id=$1) AND ($2::date IS NULL OR event.at >= $2::date) AND ($3::date IS NULL OR event.at < ($3::date + interval '1 day'))`

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDataPageParams(await searchParams)
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const values = [selected?.id ?? null, params.from, params.to, DATA_PAGE_SIZE + 1, pageOffset(params.page)]
    const [result] = await Promise.all([pool.query<TimelineRow>(query, values), pool.query<{ total: number }>(countQuery, values.slice(0, 3))])
    return <TimelineClient data={result.rows.slice(0, DATA_PAGE_SIZE)} page={params.page} hasNext={result.rows.length > DATA_PAGE_SIZE} from={params.from} to={params.to} campaignName={selected?.name ?? null} />
  } finally {}
}
