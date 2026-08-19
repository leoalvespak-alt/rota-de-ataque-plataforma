import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'

export async function GET() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const actions = await pool.query(
      `SELECT e.*, a.role, a.username, e.id::text trace_id 
       FROM engagement_actions e 
       JOIN accounts a ON a.id = e.account_id 
       WHERE ($1::uuid IS NULL OR e.campaign_id = $1) 
         AND (e.status IN ('pending','awaiting_approval','approved','running','blocked') OR e.created_at > now() - interval '24 hours') 
       ORDER BY e.created_at DESC 
       LIMIT 500`,
      [selected?.id ?? null]
    )
    return NextResponse.json(actions.rows)
  } catch (error) {
    console.error('Failed to list engagement actions', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  } finally {}
}
