import { setMaxListeners } from 'node:events'
import { readFileSync } from 'node:fs'
import { runWorker } from '../packages/queue/src/runtime.ts'
import type { QueueName } from '../packages/shared/src/index.ts'

type EngineKey = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'

const manifest = JSON.parse(
  readFileSync(new URL('./worker-supervisors.json', import.meta.url), 'utf8'),
) as Record<EngineKey, string[]>
const engine = process.argv[2]?.toUpperCase() as EngineKey | undefined
const workers = engine ? manifest[engine] : undefined

if (!engine || !workers?.length) {
  throw new Error(`Unknown worker supervisor engine: ${process.argv[2] ?? 'missing'}`)
}

// Cada runWorker registra handlers de encerramento para fechar fila, heartbeat e
// pool próprios. O supervisor aumenta apenas o limite de listeners; não remove o
// graceful shutdown individual de nenhum dos 41 consumidores.
setMaxListeners(100, process)

async function main() {
  console.log(JSON.stringify({ level: 'info', component: 'worker-supervisor', engine, state: 'starting', workers }))
  const fallbacks: Array<{ worker: string; reasonCode: 'PROVIDER_NOT_CONFIGURED' | 'PREREQUISITE_MISSING'; error: string }> = []
  if (process.env.SUPERVISOR_VALIDATE_ONLY !== 'true') {
    for (const worker of workers) {
      try {
        await import(new URL(`../workers/${worker}/src/main.ts`, import.meta.url).href)
      } catch (cause) {
        const error = String(cause)
        const reasonCode = /configuration is incomplete/iu.test(error) ? 'PROVIDER_NOT_CONFIGURED' : 'PREREQUISITE_MISSING'
        fallbacks.push({ worker, reasonCode, error })
        console.error(JSON.stringify({ level: 'error', component: 'worker-supervisor', engine, worker, state: 'worker_initialization_blocked', reasonCode, error }))
        runWorker(worker as QueueName, async () => {
          throw Object.assign(new Error(`Worker initialization prerequisite failed: ${error}`), { reasonCode })
        })
      }
    }
  }
  console.log(JSON.stringify({ level: 'info', component: 'worker-supervisor', engine, state: process.env.SUPERVISOR_VALIDATE_ONLY === 'true' ? 'validated' : 'ready', workerCount: workers.length, fallbackCount: fallbacks.length, fallbacks }))
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: 'error', component: 'worker-supervisor', engine, state: 'startup_failed', error: String(error) }))
  process.exitCode = 1
})
