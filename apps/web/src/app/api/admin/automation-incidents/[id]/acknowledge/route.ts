import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const Input = z.object({ note: z.string().trim().min(1).max(2_000) }).strict()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const id = (await params).id
  const body = Input.safeParse(await request.json().catch(() => null))
  if (!body.success) return invalidRequestResponse('invalid_request')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const result = await pool.query(`UPDATE automation_incidents SET acknowledged_at=now(),acknowledged_by=$2,acknowledgment_note=$3 WHERE id=$1 AND resolved_at IS NULL RETURNING id,worker_name,reason_code,acknowledged_at`, [id, user.email ?? 'operator', body.data.note])
    if (!result.rows[0]) return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 })
    await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'automation_incident.acknowledge',$2,$3::jsonb)`, [user.email ?? 'operator', id, JSON.stringify({ note: body.data.note })])
    return NextResponse.json({ data: result.rows[0], meta: { traceId: crypto.randomUUID() } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
