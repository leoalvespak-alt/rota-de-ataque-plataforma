import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, installPlatformSchedulers } from './index.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')
const registry = createQueueRegistry(redisUrl)

const { pool } = createDatabase(process.env.DATABASE_URL!)
const schedulerHeartbeatKey = 'runtime:scheduler:heartbeat'

async function beatScheduler() {
  await registry.connection.set(schedulerHeartbeatKey, JSON.stringify({ instanceId: process.env.HOSTNAME ?? 'scheduler', at: new Date().toISOString() }), 'PX', 90_000)
}

async function install() {
  const { rows } = await pool.query<{ worker_name: string; cadence: string | null; enabled: boolean }>(
    `SELECT worker_name, cadence, enabled FROM worker_settings`,
  )
  const cadenceOverrides: Record<string, string> = Object.fromEntries(rows.filter((row) => row.cadence).map((row) => [row.worker_name, row.cadence!]))
  const enabledWorkers = new Set(rows.filter((row) => row.enabled).map((row) => row.worker_name))
  await installPlatformSchedulers(registry, cadenceOverrides, enabledWorkers)
  await beatScheduler()
  console.log(JSON.stringify({ level: 'info', component: 'scheduler', state: 'installed', enabledWorkers: [...enabledWorkers], overrides: Object.keys(cadenceOverrides), at: new Date().toISOString() }))
}
await install()
// Reconcile every 5 minutes so UI-set cadences take effect quickly
const timer = setInterval(() => void install().catch((error) => console.error(JSON.stringify({ level: 'error', component: 'scheduler', code: 'INSTALL_FAILED', error: error instanceof Error ? error.message : 'unknown' }))), 5 * 60 * 1000)
const heartbeatTimer = setInterval(() => void beatScheduler().catch((error) => console.error(JSON.stringify({ level: 'error', component: 'scheduler', code: 'HEARTBEAT_FAILED', error: error instanceof Error ? error.message : 'unknown' }))), 30_000)

async function stop() {
  clearInterval(timer)
  clearInterval(heartbeatTimer)
  await Promise.all(Object.values(registry.queues).map((queue) => queue.close()))
  await registry.connection.quit()
  await pool.end()
  process.exit(0)
}
process.once('SIGTERM', () => void stop())
process.once('SIGINT', () => void stop())
