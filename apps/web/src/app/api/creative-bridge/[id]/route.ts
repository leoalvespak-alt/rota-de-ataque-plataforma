import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ status: z.enum(['accepted', 'rejected', 'cancelled']) }).strict()
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('operator')
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const { id } = await params
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const result = await pool.query(`UPDATE creative_bridge_deliveries SET status=$2,updated_at=now() WHERE id=$1 RETURNING *`, [id, parsed.data.status])
    if (!result.rowCount) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,$2,$3,$4::jsonb)`, [user.email ?? 'unknown', `creative_bridge.${parsed.data.status}`, id, JSON.stringify({ correlationId: result.rows[0].correlation_id })])
    return NextResponse.json({ delivery: result.rows[0] })
  } finally {}
}
