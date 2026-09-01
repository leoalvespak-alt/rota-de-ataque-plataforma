import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ accountId: z.string().uuid().optional(), enabled: z.boolean() }).strict()
export async function GET() {
  await requireRole('viewer')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const result = await pool.query<{ enabled: boolean }>(`SELECT enabled FROM runtime_controls WHERE control_key = 'kill-switch:global'`)
  return NextResponse.json({ enabled: result.rows[0]?.enabled === true })
}
export async function POST(request: Request) {
  const user = await requireRole('admin')
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  const { accountId, enabled } = parsed.data
  const key = accountId ? `kill-switch:account:${accountId}` : 'kill-switch:global'
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  await pool.query(`INSERT INTO runtime_controls(control_key, enabled, updated_at) VALUES($1,$2,now()) ON CONFLICT(control_key) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=now()`, [key, enabled])
  await pool.query(`INSERT INTO runtime_control_audit(actor, control_key, account_id, enabled) VALUES($1,$2,$3,$4)`, [user.email ?? 'unknown', key, accountId ?? null, enabled])
  return NextResponse.json({ ok: true, key, enabled })
}
