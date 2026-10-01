import { randomUUID } from 'node:crypto'
import { createDatabase } from '@plataforma/db'
import { PostgresTaskRunStore, type TaskSqlPool } from '@plataforma/task-runtime/postgres-store'
import { EditorialTaskSupervisor } from '@plataforma/task-runtime/supervisor'
import { createNewsRadarTaskHandler } from '@plataforma/worker-news-radar/runtime'
import { createInboxMessageTaskHandler, createInboxRetentionCleanupTaskHandler } from './inbox.js'
import { createPublicationDueTaskHandler } from './publication.js'
import { createSlotComposeTaskHandler } from './slot-compose.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const { pool } = createDatabase(databaseUrl)
const store = new PostgresTaskRunStore(pool as unknown as TaskSqlPool)
const owner = `${process.env.HOSTNAME ?? 'editorial-executor'}:${process.pid}:${randomUUID()}`
const supervisor = new EditorialTaskSupervisor(store, {
  owner,
  handlers: {
    'news-radar.daily': createNewsRadarTaskHandler(pool),
    'slot.compose': createSlotComposeTaskHandler(pool),
    'publication.due': createPublicationDueTaskHandler(pool),
    'inbox.message': createInboxMessageTaskHandler(pool),
    'inbox.retention.cleanup': createInboxRetentionCleanupTaskHandler(pool),
  },
  outboxHandlers: {
    'news-radar.completed': async event => console.info(JSON.stringify({ eventKey: event.eventKey, eventType: event.eventType, payload: event.payload })),
    'task.failed': async event => console.error(JSON.stringify({ eventKey: event.eventKey, eventType: event.eventType, payload: event.payload })),
  },
  onError: error => console.error('editorial executor error', error),
})

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  try { await supervisor.stop() }
  finally { await pool.end() }
}

process.on('SIGTERM', () => { void stop() })
process.on('SIGINT', () => { void stop() })

async function start() {
  if (process.env.EDITORIAL_EXECUTOR_ENABLED !== 'true') {
    console.info('Editorial executor remains disabled; set EDITORIAL_EXECUTOR_ENABLED=true after the production cutover gate.')
    await pool.end()
    return
  }
  const expectedMigration = process.env.EXPECTED_DB_MIGRATION ?? '0057_pauta_registry'
  const migration = await pool.query<{ applied: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version=$1) AS applied`,
    [expectedMigration],
  )
  if (migration.rows[0]?.applied !== true) throw new Error(`Required database migration ${expectedMigration} is not applied`)
  await supervisor.start()
  console.info(JSON.stringify({ event: 'editorial_executor.started', owner, enabledTaskHandlers: ['news-radar.daily', 'slot.compose', 'publication.due', 'inbox.message', 'inbox.retention.cleanup'] }))
}

void start().catch(async error => {
  console.error('editorial executor failed to start', error)
  process.exitCode = 1
  await pool.end().catch(() => undefined)
})
