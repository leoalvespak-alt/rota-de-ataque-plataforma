import { createDatabase } from '@plataforma/db'
import { Redis } from 'ioredis'

export const SCHEDULER_HEARTBEAT_KEY = 'runtime:scheduler:heartbeat'
const HEARTBEAT_MAX_AGE_SECONDS = 90
const DEFAULT_EXPECTED_MIGRATION = '0038_reddit_observation_context'

type ComponentStatus = 'ok' | 'error' | 'unavailable'
export interface HealthPayload {
  ok: boolean
  service: 'web'
  status: 'online' | 'ready' | 'operational' | 'degraded' | 'unavailable'
  dependencies?: Record<string, ComponentStatus>
  operational?: {
    scheduler: 'running' | 'missing'
    workersExpected: number
    workersCurrent: number
    workersRunning: number
    workersPaused: number
    missingConsumers: string[]
    configuredButNotRunning: string[]
    staleHeartbeats: string[]
  }
  at: string
  traceId: string
}

function makePayload(input: Omit<HealthPayload, 'at' | 'traceId'>): HealthPayload {
  return { ...input, at: new Date().toISOString(), traceId: crypto.randomUUID() }
}

function redisClient(url: string) {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3_000 })
}

export async function expectedMigrationApplied(
  database: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> },
  expected = process.env.EXPECTED_DB_MIGRATION ?? DEFAULT_EXPECTED_MIGRATION,
) {
  const result = await database.query<{ applied: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1) AS applied',
    [expected],
  )
  return result.rows[0]?.applied === true
}

export function liveHealth() {
  return makePayload({ ok: true, service: 'web', status: 'online' })
}

async function checkEmbeddings(endpoint: string): Promise<ComponentStatus> {
  try {
    const response = await fetch(`${endpoint.replace(/\/$/u, '')}/info`, { signal: AbortSignal.timeout(3_000), cache: 'no-store' })
    return response.ok ? 'ok' : 'error'
  } catch {
    return 'unavailable'
  }
}

async function checkScheduler(redis: Redis) {
  try {
    const heartbeat = await redis.get(SCHEDULER_HEARTBEAT_KEY)
    if (!heartbeat) return false
    const parsed = JSON.parse(heartbeat) as { at?: string }
    return Boolean(parsed.at && Date.now() - new Date(parsed.at).getTime() <= HEARTBEAT_MAX_AGE_SECONDS * 1_000)
  } catch {
    return false
  }
}

export async function readinessHealth(): Promise<HealthPayload> {
  const databaseUrl = process.env.DATABASE_URL
  const redisUrl = process.env.REDIS_URL
  const embeddingsUrl = process.env.EMBEDDINGS_ENDPOINT
  if (!databaseUrl || !redisUrl || !embeddingsUrl) {
    return makePayload({ ok: false, service: 'web', status: 'unavailable', dependencies: { database: 'unavailable', cache: 'unavailable', embeddings: 'unavailable', migrations: 'unavailable', scheduler: 'unavailable' } })
  }
  const { pool } = createDatabase(databaseUrl)
  const redis = redisClient(redisUrl)
  try {
    await redis.connect()
    const [database, cache, embeddings, migrations, scheduler] = await Promise.all([
      pool.query('SELECT 1').then(() => 'ok' as const).catch(() => 'error' as const),
      redis.ping().then((value) => value === 'PONG' ? 'ok' as const : 'error' as const).catch(() => 'error' as const),
      checkEmbeddings(embeddingsUrl),
      expectedMigrationApplied(pool).then((applied) => applied ? 'ok' as const : 'error' as const).catch(() => 'error' as const),
      checkScheduler(redis).then((available) => available ? 'ok' as const : 'unavailable' as const),
    ])
    const ok = Object.values({ database, cache, embeddings, migrations, scheduler }).every((value) => value === 'ok')
    return makePayload({ ok, service: 'web', status: ok ? 'ready' : 'degraded', dependencies: { database, cache, embeddings, migrations, scheduler } })
  } catch {
    return makePayload({ ok: false, service: 'web', status: 'unavailable', dependencies: { database: 'error', cache: 'error', embeddings: 'unavailable', migrations: 'unavailable', scheduler: 'unavailable' } })
  } finally {
    await redis.quit().catch(() => undefined)
  }
}

export async function operationalHealth(): Promise<HealthPayload> {
  const databaseUrl = process.env.DATABASE_URL
  const redisUrl = process.env.REDIS_URL
  const emptyOperational = { scheduler: 'missing' as const, workersExpected: 0, workersCurrent: 0, workersRunning: 0, workersPaused: 0, missingConsumers: [], configuredButNotRunning: [], staleHeartbeats: [] }
  if (!databaseUrl || !redisUrl) return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  const { pool } = createDatabase(databaseUrl)
  const redis = redisClient(redisUrl)
  try {
    await redis.connect()
    const scheduler = await checkScheduler(redis)
    const result = await pool.query<{ worker_name: string; enabled: boolean; state: string | null; last_beat_at: string | null }>(`SELECT ws.worker_name, ws.enabled, heartbeat.state, heartbeat.last_beat_at::text
      FROM worker_settings ws
      LEFT JOIN LATERAL (SELECT state, last_beat_at FROM worker_heartbeats WHERE worker = ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true
      ORDER BY ws.worker_name`)
    const fresh = (row: typeof result.rows[number]) => Boolean(row.last_beat_at && Date.now() - new Date(row.last_beat_at).getTime() <= HEARTBEAT_MAX_AGE_SECONDS * 1_000)
    const missingConsumers = result.rows.filter((row) => !fresh(row)).map((row) => row.worker_name)
    const configuredButNotRunning = result.rows.filter((row) => row.enabled && (!fresh(row) || row.state !== 'running')).map((row) => row.worker_name)
    const staleHeartbeats = result.rows.filter((row) => fresh(row) && row.state !== 'running' && row.state !== 'paused').map((row) => row.worker_name)
    const operational = { scheduler: scheduler ? 'running' as const : 'missing' as const, workersExpected: result.rows.filter((row) => row.enabled).length, workersCurrent: result.rows.length - missingConsumers.length, workersRunning: result.rows.filter((row) => fresh(row) && row.state === 'running').length, workersPaused: result.rows.filter((row) => fresh(row) && row.state === 'paused').length, missingConsumers, configuredButNotRunning, staleHeartbeats }
    const ok = scheduler && missingConsumers.length === 0 && configuredButNotRunning.length === 0 && staleHeartbeats.length === 0
    return makePayload({ ok, service: 'web', status: ok ? 'operational' : scheduler ? 'degraded' : 'unavailable', operational })
  } catch {
    return makePayload({ ok: false, service: 'web', status: 'unavailable', operational: emptyOperational })
  } finally {
    await redis.quit().catch(() => undefined)
  }
}
