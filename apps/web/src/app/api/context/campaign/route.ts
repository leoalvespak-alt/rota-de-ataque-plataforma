import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { appPath } from '@/lib/base-path'
import { CAMPAIGN_COOKIE } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

const Input = z.object({ campaignId: z.string().uuid() })

export async function POST(request: Request) {
  await requireRole('viewer')
  const parsed = Input.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'invalid_campaign' }, { status: 400 })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const campaign = (await pool.query<{ id: string; name: string }>(`SELECT id,name FROM campaigns WHERE id=$1 AND status='active'`, [parsed.data.campaignId])).rows[0]
    if (!campaign) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 })
    const store = await cookies()
    store.set(CAMPAIGN_COOKIE, campaign.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: appPath('/') || '/', maxAge: 60 * 60 * 24 * 365 })
    return NextResponse.json({ data: campaign, meta: { generatedAt: new Date().toISOString() } })
  } finally {}
}
