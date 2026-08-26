import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import { AutomationsTabs } from './AutomationsTabs'
import SettingsPage from '../configuracoes/SettingsPage'

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedTab = typeof params.aba === 'string' ? params.aba : 'motores'
  if (['contas', 'ia', 'scoring', 'notificacoes', 'saude', 'runbooks'].includes(requestedTab)) {
    return <SettingsPage searchParams={Promise.resolve(params)} />
  }

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
        if (!queue) return { ...w, bullmq: null, divergence: null }
        const counts = await queue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed')
        return {
          ...w,
          bullmq: {
            waiting: counts.waiting ?? 0,
            delayed: counts.delayed ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
          },
          divergence: w.enabled && w.heartbeat_state !== 'running' ? 'configured_but_not_running'
            : !w.enabled && w.heartbeat_state === 'running' ? 'running_but_disabled'
            : null,
        }
      } catch {
        return { ...w, bullmq: null, divergence: null }
      }
    }))

    return <AutomationsTabs workers={JSON.parse(JSON.stringify(enriched))} />
  } finally {
    await Promise.all(Object.values(registry.queues).map(q => q.close()))
    await registry.connection.quit()
  }
}
