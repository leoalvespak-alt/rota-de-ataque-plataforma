import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const compose = readFileSync(path.join(root, 'docker', 'docker-compose.dokploy.yml'), 'utf8')
const workerEntrypoint = readFileSync(path.join(root, 'docker', 'worker-entrypoint.sh'), 'utf8')
const supervisorManifest = JSON.parse(readFileSync(path.join(root, 'docker', 'worker-supervisors.json'), 'utf8'))
const engines = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
const supervisors = [...compose.matchAll(/^  worker-engine-(m[0-6]):$/gmu)].map((match) => match[1].toUpperCase())
const workers = engines.flatMap((engine) => supervisorManifest[engine] ?? [])
const expected = [
  'discovery', 'extraction', 'meta-sync', 'meta-webhook-consumer', 'classification', 'scoring', 'enrichment', 'engagement', 'dm-copilot', 'conversation-agent', 'private-reply', 'mention-monitor', 'reciprocity-detector', 'nba-engine', 'competitive-intel', 'content-opportunity', 'community-map', 'conversion-tracking', 'data-quality', 'alerts', 'audience-overlap', 'follower-mining', 'search-mining', 'collab-discovery', 'live-monitor', 'retention-tracker', 'source-roi', 'adaptive-crawler', 'publisher', 'content-item-orchestrator', 'news-radar', 'reddit-intelligence', 'threads-adapter', 'threads-publisher', 'email-flow-engine', 'email-events-consumer', 'whatsapp-inbound', 'whatsapp-outbound', 'identity-resolver', 'next-best-channel', 'contact-policy-engine',
]
const missing = expected.filter((worker) => !workers.includes(worker))
const extra = workers.filter((worker) => !expected.includes(worker))
const duplicates = workers.filter((worker, index) => workers.indexOf(worker) !== index)
if (!compose.includes('  scheduler:')) throw new Error('Dokploy compose must declare scheduler')
if (!compose.includes('  env_file: .env')) throw new Error('Dokploy compose must preserve env_file: .env')
if (engines.some((engine) => !supervisors.includes(engine)) || supervisors.length !== engines.length) throw new Error(`Runtime compose must declare exactly the seven engine supervisors; found=${supervisors.join(',')}`)
if (missing.length || extra.length || duplicates.length || workers.length !== expected.length) throw new Error(`Supervisor manifest mismatch: missing=${missing.join(',')} extra=${extra.join(',')} duplicates=${duplicates.join(',')} count=${workers.length}`)
for (const worker of workers) if (!existsSync(path.join(root, 'workers', worker, 'src', 'main.ts'))) throw new Error(`Supervisor worker entrypoint does not exist: ${worker}`)
for (const engine of engines) if (!compose.includes(`command: ["supervisor", "${engine}"]`)) throw new Error(`Compose command is missing for supervisor ${engine}`)
if (!workerEntrypoint.includes('exec node --import tsx --enable-source-maps /app/docker/worker-supervisor.ts "$engine"')) throw new Error('Worker entrypoint must exec one Node process per engine supervisor with the tsx loader')
if (workerEntrypoint.includes('exec pnpm')) throw new Error('Worker entrypoint must not keep pnpm resident in every worker container')
console.log(`Runtime compose covers scheduler, ${supervisors.length} engine supervisors and ${workers.length} worker consumers.`)
