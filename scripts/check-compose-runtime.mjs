import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const compose = readFileSync(path.join(root, 'docker', 'docker-compose.dokploy.yml'), 'utf8')
const workers = [...compose.matchAll(/^  worker-([a-z0-9-]+):$/gmu)].map((match) => match[1])
const expected = [
  'discovery', 'extraction', 'meta-sync', 'meta-webhook-consumer', 'classification', 'scoring', 'enrichment', 'engagement', 'dm-copilot', 'conversation-agent', 'private-reply', 'mention-monitor', 'reciprocity-detector', 'nba-engine', 'competitive-intel', 'content-opportunity', 'community-map', 'conversion-tracking', 'data-quality', 'alerts', 'audience-overlap', 'follower-mining', 'search-mining', 'collab-discovery', 'live-monitor', 'retention-tracker', 'source-roi', 'adaptive-crawler', 'publisher', 'content-item-orchestrator', 'news-radar', 'reddit-intelligence', 'threads-adapter', 'threads-publisher', 'email-flow-engine', 'email-events-consumer', 'whatsapp-inbound', 'whatsapp-outbound', 'identity-resolver', 'next-best-channel', 'contact-policy-engine',
]
const missing = expected.filter((worker) => !workers.includes(worker))
const extra = workers.filter((worker) => !expected.includes(worker))
if (!compose.includes('  scheduler:')) throw new Error('Dokploy compose must declare scheduler')
if (!compose.includes('  env_file: .env')) throw new Error('Dokploy compose must preserve env_file: .env')
if (missing.length || extra.length || workers.length !== expected.length) throw new Error(`Runtime compose mismatch: missing=${missing.join(',')} extra=${extra.join(',')} count=${workers.length}`)
console.log(`Runtime compose covers scheduler and ${workers.length} workers.`)
