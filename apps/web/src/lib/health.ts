import { createDatabase } from '@plataforma/db'

const HEARTBEAT_MAX_AGE_SECONDS = 90
export const DEFAULT_EXPECTED_MIGRATION = '0045_task_runtime'
type ComponentStatus = 'ok' | 'error' | 'unavailable'
export interface TaskRuntimeHealth {
  runs: { accepted: number; running: number; retryScheduled: number; failedLast24h: number; overdue: number; staleRunning: number }
  schedules: { total: number; enabled: number; disabled: number; entries: Array<{ taskName: string; destination: string; cadence: string; enabled: boolean }> }
}
export interface HealthPayload {
  ok: boolean
  service: 'web'
  status: 'online' | 'ready' | 'operational' | 'degraded' | 'unavailable'
  dependencies?: Record<string, ComponentStatus>
  operational?: { workersExpected: number; workersCurrent: number; workersRunning: number; workersPaused: number; missingConsumers: string[]; configuredButNotRunning: string[]; staleHeartbeats: string[]; taskRuntime: TaskRuntimeHealth }
  at: string
  traceId: string
}
function makePayload(input: Omit<HealthPayload, 'at' | 'traceId'>): HealthPayload { return { ...input, at: new Date().toISOString(), traceId: crypto.randomUUID() } }
async function databasePool() {
  const databaseUrl = process.env.DATABASE_URL
  return databaseUrl ? createDatabase(databaseUrl).pool : null
}
export async function expectedMigrationApplied(database: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }, expected = process.env.EXPECTED_DB_MIGRATION ?? DEFAULT_EXPECTED_MIGRATION) {
  const result = await database.query<{ applied: boolean }>('SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1) AS applied', [expected])
  return result.rows[0]?.applied === true
}
export async function taskRuntimeHealth(database: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }): Promise<TaskRuntimeHealth> {
  const [runsResult, schedulesResult] = await Promise.all([
    database.query<{ accepted: number; running: number; retry_scheduled: number; failed_last_24h: number; overdue: number; stale_running: number }>(`SELECT
      count(*) FILTER (WHERE status='accepted')::int accepted,
      count(*) FILTER (WHERE status='running')::int running,
      count(*) FILTER (WHERE status='retry_scheduled')::int retry_scheduled,
      count(*) FILTER (WHERE status='failed' AND COALESCE(completed_at, created_at) >= now() - interval '24 hours')::int failed_last_24h,
      count(*) FILTER (WHERE status IN ('accepted','retry_scheduled') AND COALESCE(retry_at, schedule_time, created_at) < now() - interval '5 minutes')::int overdue,
      count(*) FILTER (WHERE status='running' AND started_at < now() - interval '10 minutes')::int stale_running
      FROM task_runs`),
    database.query<{ task_name: string; destination: string; cadence: string; enabled: boolean }>('SELECT task_name, destination, cadence, enabled FROM task_schedules ORDER BY task_name'),
  ])
  const runs = runsResult.rows[0] ?? { accepted: 0, running: 0, retry_scheduled: 0, failed_last_24h: 0, overdue: 0, stale_running: 0 }
  const entries = schedulesResult.rows.map((row) => ({ taskName: row.task_name, destination: row.destination, cadence: row.cadence, enabled: row.enabled }))
  const enabled = entries.filter((entry) => entry.enabled).length
  return {
    runs: { accepted: runs.accepted, running: runs.running, retryScheduled: runs.retry_scheduled, failedLast24h: runs.failed_last_24h, overdue: runs.overdue, staleRunning: runs.stale_running },
    schedules: { total: entries.length, enabled, disabled: entries.length - enabled, entries },
  }
}
export function liveHealth() { return makePayload({ ok: true, service: 'web', status: 'online' }) }

export async function readinessHealth(): Promise<HealthPayload> {
  const pool = await databasePool()
  if (!pool) return makePayload({ ok: false, service: 'web', status: 'unavailable', dependencies: { database: 'unavailable', migrations: 'unavailable' } })
  const [database, migrations] = await Promise.all([
    pool.query('SELECT 1').then(() => 'ok' as const).catch(() => 'error' as const),
    expectedMigrationApplied(pool).then((applied) => applied ? 'ok' as const : 'error' as const).catch(() => 'error' as const),
  ])
  const ok = database === 'ok' && migrations === 'ok'
  return makePayload({ ok, service: 'web', status: ok ? 'ready' : 'degraded', dependencies: { database, migrations } })
}

export async function operationalHealth(): Promise<HealthPayload> {
  const pool = await databasePool()
  const emptyTaskRuntime: TaskRuntimeHealth = { runs: { accepted: 0, running: 0, retryScheduled: 0, failedLast24h: 0, overdue: 0, staleRunning: 0 }, schedules: { total: 0, enabled: 0, disabled: 0, entries: [] } }
  const emptyOperational = { workersExpected: 0, workersCurrent: 0, workersRunning: 0, workersPaused: 0, missingConsumers: [], configuredButNotRunning: [], staleHeartbeats: [], taskRuntime: emptyTaskRuntime }
  if (!pool) return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  try {
    const [result, taskRuntime] = await Promise.all([pool.query<{ worker_name: string; enabled: boolean; state: string | null; last_beat_at: string | null }>(`SELECT ws.worker_name, ws.enabled, heartbeat.state, heartbeat.last_beat_at::text
      FROM worker_settings ws
      LEFT JOIN LATERAL (SELECT state, last_beat_at FROM worker_heartbeats WHERE worker = ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true
      ORDER BY ws.worker_name`), taskRuntimeHealth(pool)])
    const fresh = (row: typeof result.rows[number]) => Boolean(row.last_beat_at && Date.now() - new Date(row.last_beat_at).getTime() <= HEARTBEAT_MAX_AGE_SECONDS * 1_000)
    const missingConsumers = result.rows.filter((row) => row.enabled && !fresh(row)).map((row) => row.worker_name)
    const configuredButNotRunning = result.rows.filter((row) => row.enabled && (!fresh(row) || row.state !== 'running')).map((row) => row.worker_name)
    const staleHeartbeats = result.rows.filter((row) => fresh(row) && row.state !== 'running' && row.state !== 'paused').map((row) => row.worker_name)
    const operational = { workersExpected: result.rows.filter((row) => row.enabled).length, workersCurrent: result.rows.filter(fresh).length, workersRunning: result.rows.filter((row) => fresh(row) && row.state === 'running').length, workersPaused: result.rows.filter((row) => fresh(row) && row.state === 'paused').length, missingConsumers, configuredButNotRunning, staleHeartbeats, taskRuntime }
    const ok = missingConsumers.length === 0 && configuredButNotRunning.length === 0 && staleHeartbeats.length === 0 && taskRuntime.runs.overdue === 0 && taskRuntime.runs.staleRunning === 0
    return makePayload({ ok, service: 'web', status: ok ? 'operational' : 'degraded', operational })
  } catch {
    return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  }
}
