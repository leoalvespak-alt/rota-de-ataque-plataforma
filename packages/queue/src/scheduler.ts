import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, installPlatformSchedulers } from './index.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')
const registry = createQueueRegistry(redisUrl)

const { pool } = createDatabase(process.env.DATABASE_URL!)

async function install() {
  const { rows } = await pool.query<{ worker_name: string; cadence: string }>(
    `SELECT worker_name, cadence FROM worker_settings WHERE cadence IS NOT NULL`,
  )
  const cadenceOverrides: Record<string, string> = Object.fromEntries(rows.map((r) => [r.worker_name, r.cadence]))
  await installPlatformSchedulers(registry, cadenceOverrides)
  console.log(JSON.stringify({ level: 'info', component: 'scheduler', state: 'installed', overrides: Object.keys(cadenceOverrides), at: new Date().toISOString() }))
}
await install()
// Reconcile every 5 minutes so UI-set cadences take effect quickly
const timer = setInterval(() => void install().catch((error) => console.error(JSON.stringify({ level: 'error', component: 'scheduler', code: 'INSTALL_FAILED', error: error instanceof Error ? error.message : 'unknown' }))), 5 * 60 * 1000)

async function stop() {
  clearInterval(timer)
  await Promise.all(Object.values(registry.queues).map((queue) => queue.close()))
  await registry.connection.quit()
  process.exit(0)
}
process.once('SIGTERM', () => void stop())
process.once('SIGINT', () => void stop())
