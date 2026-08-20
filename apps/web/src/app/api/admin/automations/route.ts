import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, MANAGED_SCHEDULER_CONFIG, parseCadence } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'
import { getCampaignContext } from '@/lib/campaign-context'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['enable', 'disable', 'run_now', 'pause', 'resume', 'clear_dlq']), workerName: z.string() }),
  z.object({ action: z.literal('set_schedule'), workerName: z.string(), cadence: z.string().trim().min(1).max(100) }),
])

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    const workers = await pool.query(
      `SELECT ws.*,
        wh.last_beat_at, wh.jobs_done_window, wh.jobs_failed_window, wh.backlog_seen, wh.p95_latency_ms, wh.state AS heartbeat_state
       FROM worker_settings ws
       LEFT JOIN LATERAL (
         SELECT last_beat_at, jobs_done_window, jobs_failed_window, backlog_seen, p95_latency_ms, state
         FROM worker_heartbeats
         WHERE worker = ws.worker_name
         ORDER BY last_beat_at DESC
         LIMIT 1
       ) wh ON true
       ORDER BY ws.domain, ws.worker_name`
    )

    const enriched = await Promise.all(workers.rows.map(async (w: any) => {
      try {
        const queue = registry.queues[w.worker_name as keyof typeof registry.queues]
        if (!queue) return { ...w, bullmq: null }
        const counts = await queue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed')
        const schedulers = await queue.getJobSchedulers()
        return {
          ...w,
          bullmq: {
            waiting: counts.waiting ?? 0,
            delayed: counts.delayed ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            schedulers: schedulers.map((s: any) => ({ id: s.id, pattern: s.pattern, every: s.every, next: s.next })),
          },
          divergence: w.enabled && w.heartbeat_state !== 'running' ? 'configured_but_not_running'
            : !w.enabled && w.heartbeat_state === 'running' ? 'running_but_disabled'
            : null,
        }
      } catch {
        return { ...w, bullmq: null }
      }
    }))

    return NextResponse.json({ workers: enriched })
  } finally {
    await registry.connection.quit()
  }
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse()

  const { workerName, action } = parsed.data
  const cadence = 'cadence' in parsed.data ? parsed.data.cadence : undefined
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    // set_schedule is an operational config action, not a worker command; handle it separately
    if (action === 'set_schedule') {
      await pool.query('UPDATE worker_settings SET cadence = $2, updated_at = now() WHERE worker_name = $1', [workerName, cadence])
      const queue = registry.queues[workerName as keyof typeof registry.queues]
      if (queue && cadence) {
        const opts = parseCadence(cadence)
        const config = MANAGED_SCHEDULER_CONFIG[workerName as keyof typeof MANAGED_SCHEDULER_CONFIG]
        // Use the primary scheduler ID so installPlatformSchedulers won't create a duplicate
        const schedulerId = config?.primaryId ?? `${workerName}-managed-v1`
        const data = config?.data ?? {}
        await queue.upsertJobScheduler(schedulerId, opts, { name: workerName, data })
      }
      await pool.query("INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, 'worker.set_schedule', $2, $3::jsonb)", [user.email ?? 'operator', workerName, JSON.stringify({ cadence })])
      return NextResponse.json({ ok: true, action, workerName, cadence })
    }

    const command = await pool.query<{ id: string }>(
      `INSERT INTO worker_commands(worker_name,command_type,payload,requested_by)
       VALUES($1,$2,$3::jsonb,$4) RETURNING id`,
      [workerName, action, JSON.stringify({}), user.email ?? null],
    )
    const commandId = command.rows[0]?.id
    switch (action) {
      case 'enable':
        await pool.query('UPDATE worker_settings SET enabled = true, updated_at = now() WHERE worker_name = $1', [workerName])
        break
      case 'disable':
        await pool.query('UPDATE worker_settings SET enabled = false, updated_at = now() WHERE worker_name = $1', [workerName])
        break
      case 'run_now': {
        const queue = registry.queues[workerName as keyof typeof registry.queues]
        if (!queue) return NextResponse.json({ error: 'queue_not_found' }, { status: 404 })
        const { selected } = await getCampaignContext(pool)
        const payloads: Record<string, Record<string, unknown> | undefined> = {
          'news-radar': { mode: 'incremental' },
          'data-quality': { refreshViews: true },
          'competitive-intel': { windowDays: 30 },
          'reddit-intelligence': {},
          'publisher': {},
          'threads-publisher': {},
          'content-opportunity': selected ? { campaignId: selected.id, limit: 25 } : undefined,
        }
        // Fall back to an empty payload for workers not in the explicit map
        const payload = payloads[workerName] ?? {}
        const job = await queue.add(`${workerName}-manual`, { ...payload, manual: true, triggeredBy: user.email, commandId })
        await pool.query(`UPDATE worker_commands SET payload=$2::jsonb,status='enqueued',job_id=$3 WHERE id=$1`, [commandId, JSON.stringify(payload), String(job.id)])
        await pool.query("INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, 'worker.run_now', $2, $3::jsonb)", [user.email, workerName, JSON.stringify({ jobId: job.id, commandId, payload })])
        return NextResponse.json({ jobId: job.id, commandId, status: 'enqueued' })
      }
      case 'clear_dlq': {
        const queue = registry.queues[workerName as keyof typeof registry.queues]
        if (!queue) return NextResponse.json({ error: 'queue_not_found' }, { status: 404 })
        const failed = await queue.getFailed(0, 100)
        for (const job of failed) await job.remove()
        await pool.query("INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, 'worker.clear_dlq', $2, $3)", [user.email, workerName, { cleared: failed.length }])
        return NextResponse.json({ cleared: failed.length })
      }
      default:
        await pool.query('UPDATE worker_settings SET enabled = $2, updated_at = now() WHERE worker_name = $1', [workerName, action === 'resume'])
    }

    await pool.query(`UPDATE worker_commands SET status='completed',completed_at=now() WHERE id=$1`, [commandId])
    await pool.query("INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, $2, $3, $4::jsonb)", [user.email, `worker.${action}`, workerName, JSON.stringify({ action, commandId })])
    return NextResponse.json({ ok: true, action, workerName, commandId })
  } finally {
    await registry.connection.quit()
  }
}
