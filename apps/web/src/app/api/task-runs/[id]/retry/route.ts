import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('admin')
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const retried = await client.query<{ id: string }>(
      `UPDATE editorial.task_runs SET status='accepted',available_at=now(),retry_at=NULL,completed_at=NULL,error=NULL,
         max_attempts=GREATEST(max_attempts,attempt+1),lease_owner=NULL,lease_until=NULL,updated_at=now()
       WHERE id=$1::uuid AND status='failed' RETURNING id`,
      [id],
    )
    if (!retried.rows[0]) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: false, error: 'task_not_failed' }, { status: 409 })
    }
    await client.query(
      `INSERT INTO editorial.task_run_audit(task_run_id,actor,action,previous_status) VALUES($1::uuid,$2,'retry','failed')`,
      [id, user.email ?? 'unknown'],
    )
    await client.query(`UPDATE editorial.task_runtime_meta SET used_at=COALESCE(used_at,now()) WHERE key='editorial-executor'`)
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, id, status: 'accepted' })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === '42703') return NextResponse.json({ ok: false, error: 'task_runtime_not_ready' }, { status: 503 })
    throw error
  } finally {
    client.release()
  }
}
