import { setMaxListeners } from 'node:events'
import { readFileSync } from 'node:fs'

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
  if (process.env.SUPERVISOR_VALIDATE_ONLY !== 'true') {
    for (const worker of workers) {
      await import(new URL(`../workers/${worker}/src/main.ts`, import.meta.url).href)
    }
  }
  console.log(JSON.stringify({ level: 'info', component: 'worker-supervisor', engine, state: process.env.SUPERVISOR_VALIDATE_ONLY === 'true' ? 'validated' : 'ready', workerCount: workers.length }))
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: 'error', component: 'worker-supervisor', engine, state: 'startup_failed', error: String(error) }))
  process.exitCode = 1
})
