import { setMaxListeners } from 'node:events'
import { readFileSync } from 'node:fs'
import { createDatabase } from '../packages/db/src/index.ts'
import { runWorker } from '../packages/queue/src/runtime.ts'
import type { QueueName } from '../packages/shared/src/index.ts'

type EngineKey = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'
const manifest = JSON.parse(readFileSync(new URL('./worker-supervisors.json', import.meta.url), 'utf8')) as Record<EngineKey, string[]>
const engine = process.argv[2]?.toUpperCase() as EngineKey | undefined
const workers = engine ? manifest[engine] : undefined

if (!engine || !workers?.length) throw new Error(`Unknown worker supervisor engine: ${process.argv[2] ?? 'missing'}`)
setMaxListeners(100, process)

const flagName = (worker: string) => `WORKER_${worker.replaceAll('-', '_').toUpperCase()}_ENABLED`
const redacted = (value: unknown) => String(value).replace(/(authorization|cookie|token|password|secret|email)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]').slice(0, 500)

async function desiredWorkers() {
  const fallback = new Set(workers.filter((worker) => process.env[flagName(worker)] === 'true'))
  if (!process.env.DATABASE_URL) return fallback
  const { pool } = createDatabase(process.env.DATABASE_URL)
  try {
    const result = await pool.query<{ worker_name: string; enabled: boolean }>('SELECT worker_name,enabled FROM worker_settings WHERE worker_name = ANY($1::text[])', [workers])
    const rows = new Map(result.rows.map((row) => [row.worker_name, row.enabled]))
    return new Set(workers.filter((worker) => rows.get(worker) ?? process.env[flagName(worker)] === 'true'))
  } finally { await pool.end() }
}

async function main() {
  const enabled = await desiredWorkers()
  const disabled = workers.filter((worker) => !enabled.has(worker))
  console.log(JSON.stringify({ level: 'info', component: 'worker-supervisor', engine, state: 'starting', workers, desiredEnabled: [...enabled], paused: disabled }))
  const fallbacks: Array<{ worker: string; reasonCode: 'PROVIDER_NOT_CONFIGURED' | 'PREREQUISITE_MISSING'; error: string }> = []
  if (process.env.SUPERVISOR_VALIDATE_ONLY !== 'true') {
    // Inicializamos também consumidores desligados. O runtime lê o estado
    // persistido, pausa o consumidor e mantém heartbeat/reconciliação vivos;
    // pular o import faria o processo terminar quando todos estivessem off.
    for (const worker of workers) {
      try {
        await import(new URL(`../workers/${worker}/src/main.ts`, import.meta.url).href)
      } catch (cause) {
        const error = redacted(cause)
        const reasonCode = /PROVIDER_NOT_CONFIGURED|configuration is incomplete|missing|not configured/iu.test(error) ? 'PROVIDER_NOT_CONFIGURED' : 'PREREQUISITE_MISSING'
        fallbacks.push({ worker, reasonCode, error })
        console.error(JSON.stringify({ level: 'error', component: 'worker-supervisor', engine, worker, state: 'worker_initialization_blocked', reasonCode, error }))
        runWorker(worker as QueueName, async () => { throw Object.assign(new Error(`Worker initialization prerequisite failed: ${error}`), { reasonCode }) })
      }
    }
  }
  console.log(JSON.stringify({ level: 'info', component: 'worker-supervisor', engine, state: process.env.SUPERVISOR_VALIDATE_ONLY === 'true' ? 'validated' : 'ready', workerCount: workers.length, activeCount: enabled.size, pausedCount: disabled.length, fallbackCount: fallbacks.length, fallbacks }))
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: 'error', component: 'worker-supervisor', engine, state: 'startup_failed', error: redacted(error) }))
  process.exitCode = 1
})
