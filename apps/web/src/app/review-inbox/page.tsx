import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { ReviewInboxClient } from './ReviewInboxClient'

export default async function ReviewInboxPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const [items, stats] = await Promise.all([
      pool.query(`SELECT id,item_type,reason,suggested_action,context,created_at FROM review_inbox WHERE (status='pending' OR (status='snoozed' AND COALESCE(context->>'snooze_until','') <= now()::text)) AND ($1::uuid IS NULL OR context->>'campaignId'=$1::text) ORDER BY created_at ASC LIMIT 200`, [selected?.id ?? null]),
      pool.query<{ count:string }>(`SELECT COUNT(*)::text count FROM review_inbox WHERE decided_at::date=CURRENT_DATE AND ($1::uuid IS NULL OR context->>'campaignId'=$1::text)`, [selected?.id ?? null]),
    ])
    return <ReviewInboxClient initialItems={items.rows} decidedToday={Number(stats.rows[0]?.count ?? 0)}/>
  } finally { await pool.end() }
}
