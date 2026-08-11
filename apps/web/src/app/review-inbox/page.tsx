import { createDatabase } from '@plataforma/db'
import { ReviewInboxClient } from './ReviewInboxClient'

export const dynamic = 'force-dynamic'
export default async function ReviewInboxPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const [items, stats] = await Promise.all([
      pool.query(`SELECT id,item_type,reason,suggested_action,context,created_at FROM review_inbox WHERE status='pending' OR (status='snoozed' AND COALESCE(context->>'snooze_until','') <= now()::text) ORDER BY created_at ASC LIMIT 200`),
      pool.query<{ count:string }>(`SELECT COUNT(*)::text count FROM review_inbox WHERE decided_at::date=CURRENT_DATE`),
    ])
    return <ReviewInboxClient initialItems={items.rows} decidedToday={Number(stats.rows[0]?.count ?? 0)}/>
  } finally { await pool.end() }
}
