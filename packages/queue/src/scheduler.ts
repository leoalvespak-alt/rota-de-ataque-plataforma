import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce, installPlatformSchedulers } from './index.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')
const registry = createQueueRegistry(redisUrl)

const { pool } = createDatabase(process.env.DATABASE_URL!)
const schedulerHeartbeatKey = 'runtime:scheduler:heartbeat'

async function beatScheduler() {
  await registry.connection.set(schedulerHeartbeatKey, JSON.stringify({ instanceId: process.env.HOSTNAME ?? 'scheduler', at: new Date().toISOString() }), 'PX', 90_000)
}

function configuredProvider(preference: 'auto' | 'apify' | 'bright_data') {
  const hashSaltReady = Boolean(process.env.DISCOVERY_AUTHOR_HASH_SALT?.trim())
  const apify = process.env.APIFY_ENABLED === 'true' && hashSaltReady && Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_REDDIT_ACTOR_ID?.trim())
  const brightData = process.env.BRIGHT_DATA_ENABLED === 'true' && hashSaltReady && Boolean(process.env.BRIGHT_DATA_API_KEY?.trim() && process.env.BRIGHT_DATA_DATASET_ID?.trim())
  if (preference === 'apify') return apify ? 'apify' as const : null
  if (preference === 'bright_data') return brightData ? 'bright_data' as const : null
  return apify ? 'apify' as const : brightData ? 'bright_data' as const : null
}

function marketWatchUrl(kind: string, raw: string) {
  const value = raw.replace(/^r\//iu, '').replace(/^u\//iu, '').trim()
  if (kind === 'subreddit') return `https://www.reddit.com/r/${encodeURIComponent(value)}`
  if (kind === 'user') return `https://www.reddit.com/user/${encodeURIComponent(value)}`
  return `https://www.reddit.com/search/?q=${encodeURIComponent(value)}`
}

async function enqueueDueMarketWatches() {
  const { rows } = await pool.query<{ id: string; campaign_id: string; kind: string; value: string; provider_preference: 'auto' | 'apify' | 'bright_data'; cadence_seconds: number; next_run_at: string | null }>(
    `SELECT id,campaign_id,kind,value,provider_preference,cadence_seconds,next_run_at
       FROM market_watches
      WHERE active AND COALESCE(next_run_at,now())<=now()
      ORDER BY next_run_at NULLS FIRST
      LIMIT 25`,
  )
  let queued = 0
  for (const watch of rows) {
    const provider = configuredProvider(watch.provider_preference)
    if (!provider) {
      await pool.query(`UPDATE market_watches SET last_state='blocked',reason_code='PROVIDER_NOT_CONFIGURED',next_run_at=now()+make_interval(secs => cadence_seconds),updated_at=now() WHERE id=$1`, [watch.id])
      continue
    }
    const mode = provider === 'bright_data' ? 'fallback_collect' as const : 'social_collect' as const
    const payload = mode === 'social_collect'
      ? { mode, campaignId: watch.campaign_id, platform: 'reddit' as const, urls: [marketWatchUrl(watch.kind, watch.value)], limit: 10, watchId: watch.id }
      : { mode, campaignId: watch.campaign_id, platform: 'reddit' as const, urls: [marketWatchUrl(watch.kind, watch.value)], limit: 10, fallbackReason: 'primary_not_supported' as const, watchId: watch.id }
    await enqueueOnce(registry.queues.discovery, 'discovery', [watch.id, provider, watch.next_run_at ?? 'initial'], payload)
    await pool.query(`UPDATE market_watches SET last_state='pending',reason_code=NULL,next_run_at=now()+make_interval(secs => cadence_seconds),updated_at=now() WHERE id=$1`, [watch.id])
    queued += 1
  }
  if (rows.length) console.log(JSON.stringify({ level: 'info', component: 'scheduler', state: 'market_watches_reconciled', due: rows.length, queued, at: new Date().toISOString() }))
}

async function install() {
  const { rows } = await pool.query<{ worker_name: string; cadence: string | null; enabled: boolean }>(
    `SELECT worker_name, cadence, enabled FROM worker_settings`,
  )
  const cadenceOverrides: Record<string, string> = Object.fromEntries(rows.filter((row) => row.cadence).map((row) => [row.worker_name, row.cadence!]))
  const enabledWorkers = new Set(rows.filter((row) => row.enabled).map((row) => row.worker_name))
  await installPlatformSchedulers(registry, cadenceOverrides, enabledWorkers)
  await enqueueDueMarketWatches()
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
