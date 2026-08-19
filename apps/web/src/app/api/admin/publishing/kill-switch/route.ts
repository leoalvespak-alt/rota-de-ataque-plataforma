import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'
import { KillSwitchSchema } from '@/lib/admin-publishing-schemas'
import { requireRole } from '@/lib/permissions'

const publishers = ['publisher', 'threads-publisher'] as const

export async function GET() {
  try { await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const result = await pool.query<{ enabled: boolean }>(`SELECT enabled FROM worker_settings WHERE worker_name='publisher' LIMIT 1`)
    return NextResponse.json({ active: result.rows[0]?.enabled ?? false, origin: 'worker_settings' })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {}
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = KillSwitchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse('invalid_request')
  const active = parsed.data.action === 'resume'
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const name of publishers) {
      await client.query(`INSERT INTO worker_settings(worker_name,enabled,domain,updated_at) VALUES($1,$2,'publishing',now()) ON CONFLICT(worker_name) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=now()`, [name, active])
    }
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,$2,'publishing-kill-switch',$3::jsonb)`, [user.email ?? 'unknown', active ? 'publishing.resumed' : 'publishing.killed', JSON.stringify({ publishers, active, reason: parsed.data.reason, at: new Date().toISOString() })])
    await client.query('COMMIT')
    return NextResponse.json({ active, origin: 'operator', publishers })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    return apiErrorResponse(error)
  } finally {
    client.release()
  }
}
