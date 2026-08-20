import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const RunSchema = z.object({
  scope: z.enum(['all', 'profile', 'window']).default('all'),
  handle: z.string().optional(),
  windowDays: z.number().min(1).max(90).default(7),
})

export async function POST(request: Request) {
  const user = await requireRole('operator')
  const parsed = RunSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.flatten() }, { status: 400 })

  const { scope, handle, windowDays } = parsed.data
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    const job = await registry.queues['competitive-intel'].add('competitive-intel-manual', {
      mode: 'organic',
      windowDays,
      competitorId: handle ? (await pool.query('SELECT id FROM candidate_sources WHERE handle = $1', [handle])).rows[0]?.id : undefined,
    })

    await pool.query(
      "INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, 'research.run', $2, $3)",
      [user.email, 'competitive-intel', { scope, handle, windowDays, jobId: job.id }]
    )

    return NextResponse.json({ jobId: job.id, scope, windowDays })
  } finally {
    await registry.connection.quit()
  }
}
