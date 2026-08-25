import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, MANAGED_SCHEDULER_CONFIG } from '@plataforma/queue'
import { ENGINE_BY_KEY, type EngineKey, type QueueName } from '@plataforma/shared'
import { Redis } from 'ioredis'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { requireRole } from '@/lib/permissions'

const VALID_ENGINE_KEYS = new Set<EngineKey>(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'])

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole('operator')
  } catch (error) {
    return apiErrorResponse(error)
  }

  const { key } = await params
  if (!VALID_ENGINE_KEYS.has(key as EngineKey)) {
    return NextResponse.json({ error: 'engine_not_found' }, { status: 404 })
  }
  const engineKey = key as EngineKey
  const engine = ENGINE_BY_KEY[engineKey]
  const configuredWorkers = engine.workers.filter((workerName) => MANAGED_SCHEDULER_CONFIG[workerName])
  const { pool } = createDatabase(process.env.DATABASE_URL!)

  try {
    const schedulable = await pool.query<{ worker_name: QueueName }>(
      'SELECT worker_name FROM worker_settings WHERE schedulable = true AND worker_name = ANY($1)',
      [configuredWorkers],
    )
    const schedulableWorkers = schedulable.rows.map((row) => row.worker_name)
    if (schedulableWorkers.length === 0) {
      return NextResponse.json({ error: 'no_schedulable_workers' }, { status: 422 })
    }

    const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1, connectTimeout: 3_000 })
    try {
      const runtime = await pool.query<{ worker_name: string; state: string | null; last_beat_at: string | null }>(`SELECT settings.worker_name, heartbeat.state, heartbeat.last_beat_at::text
        FROM worker_settings settings
        LEFT JOIN LATERAL (SELECT state,last_beat_at FROM worker_heartbeats WHERE worker=settings.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true
        WHERE settings.worker_name = ANY($1)`, [schedulableWorkers])
      const unavailable = runtime.rows.filter((row) => !row.last_beat_at || Date.now() - new Date(row.last_beat_at).getTime() > 90_000 || row.state !== 'running')
      if (unavailable.length > 0) {
        return NextResponse.json({
          error: 'runtime_unavailable',
          reasonCode: 'RUNTIME_UNAVAILABLE',
          unavailableWorkers: unavailable.map((row) => row.worker_name),
          nextAction: { label: 'Ligar motor', href: '/automacoes' },
        }, { status: 409 })
      }
    } finally {
      await redis.quit().catch(() => undefined)
    }

    const registry = createQueueRegistry(process.env.REDIS_URL!)
    try {
      const enqueued: string[] = []
      const failed: string[] = []
      for (const workerName of schedulableWorkers) {
        const config = MANAGED_SCHEDULER_CONFIG[workerName]
        if (!config) {
          failed.push(workerName)
          continue
        }
        const command = await pool.query<{ id: string }>(`
          INSERT INTO worker_commands(worker_name, command_type, payload, requested_by)
          VALUES($1, 'run_now', $2::jsonb, $3)
          RETURNING id
        `, [workerName, JSON.stringify(config.data), user.email ?? null])
        const commandId = command.rows[0]?.id
        try {
          const job = await registry.queues[workerName].add(
            `${workerName}-manual`,
            { ...config.data, manual: true, triggeredBy: user.email, commandId },
          )
          await pool.query(
            "UPDATE worker_commands SET status = 'enqueued', job_id = $2 WHERE id = $1",
            [commandId, String(job.id)],
          )
          await pool.query(
            "INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, 'engine.run_now', $2, $3::jsonb)",
            [user.email ?? 'operator', engineKey, JSON.stringify({ workerName, jobId: job.id, commandId })],
          )
          enqueued.push(workerName)
        } catch {
          await pool.query(
            "UPDATE worker_commands SET status = 'failed', completed_at = now(), error_code = 'enqueue_failed' WHERE id = $1",
            [commandId],
          )
          failed.push(workerName)
        }
      }
      return NextResponse.json({ ok: failed.length === 0, engineKey, enqueued, failed })
    } finally {
      await Promise.allSettled(Object.values(registry.queues).map((queue) => queue.close()))
      await registry.connection.quit().catch(() => undefined)
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}
