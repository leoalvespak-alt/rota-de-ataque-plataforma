import { createDatabase } from '@plataforma/db'

const HEARTBEAT_MAX_AGE_SECONDS = 90
const DEFAULT_EXPECTED_MIGRATION = '0041_postgres_runtime_state'
type ComponentStatus = 'ok' | 'error' | 'unavailable'
export interface HealthPayload {
  ok: boolean
  service: 'web'
  status: 'online' | 'ready' | 'operational' | 'degraded' | 'unavailable'
  dependencies?: Record<string, ComponentStatus>
  operational?: { workersExpected: number; workersCurrent: number; workersRunning: number; workersPaused: number; missingConsumers: string[]; configuredButNotRunning: string[]; staleHeartbeats: string[] }
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
  const emptyOperational = { workersExpected: 0, workersCurrent: 0, workersRunning: 0, workersPaused: 0, missingConsumers: [], configuredButNotRunning: [], staleHeartbeats: [] }
  if (!pool) return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  try {
    const result = await pool.query<{ worker_name: string; enabled: boolean; state: string | null; last_beat_at: string | null }>(`SELECT ws.worker_name, ws.enabled, heartbeat.state, heartbeat.last_beat_at::text
      FROM worker_settings ws
      LEFT JOIN LATERAL (SELECT state, last_beat_at FROM worker_heartbeats WHERE worker = ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true
      ORDER BY ws.worker_name`)
    const fresh = (row: typeof result.rows[number]) => Boolean(row.last_beat_at && Date.now() - new Date(row.last_beat_at).getTime() <= HEARTBEAT_MAX_AGE_SECONDS * 1_000)
    const missingConsumers = result.rows.filter((row) => row.enabled && !fresh(row)).map((row) => row.worker_name)
    const configuredButNotRunning = result.rows.filter((row) => row.enabled && (!fresh(row) || row.state !== 'running')).map((row) => row.worker_name)
    const staleHeartbeats = result.rows.filter((row) => fresh(row) && row.state !== 'running' && row.state !== 'paused').map((row) => row.worker_name)
    const operational = { workersExpected: result.rows.filter((row) => row.enabled).length, workersCurrent: result.rows.filter(fresh).length, workersRunning: result.rows.filter((row) => fresh(row) && row.state === 'running').length, workersPaused: result.rows.filter((row) => fresh(row) && row.state === 'paused').length, missingConsumers, configuredButNotRunning, staleHeartbeats }
    const ok = missingConsumers.length === 0 && configuredButNotRunning.length === 0 && staleHeartbeats.length === 0
    return makePayload({ ok, service: 'web', status: ok ? 'operational' : 'degraded', operational })
  } catch {
    return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  }
}
