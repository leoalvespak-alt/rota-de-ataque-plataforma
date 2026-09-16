import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const compose = readFileSync(path.join(root, 'docker', 'docker-compose.phase7.yml'), 'utf8')
const productionCompose = readFileSync(path.join(root, 'docker', 'docker-compose.production.yml'), 'utf8')
const caddy = readFileSync(path.join(root, 'docker', 'Caddyfile.phase7'), 'utf8')

const requiredServices = ['prospector-migrate', 'prospector-web', 'design-migrate', 'design-api', 'design-web', 'editorial-caddy']
for (const service of requiredServices) if (!compose.includes(`  ${service}:`)) throw new Error(`Fase 7 compose is missing service ${service}`)
for (const marker of ['host.docker.internal:6432/prospector', 'host.docker.internal:6432/rota_design', 'condition: service_completed_successfully', 'healthcheck:', 'restart: unless-stopped']) {
  if (!compose.includes(marker)) throw new Error(`Fase 7 compose is missing ${marker}`)
}
for (const marker of ['path /prospector /prospector/*', 'reverse_proxy prospector-web:3000', 'reverse_proxy design-api:3001', 'reverse_proxy design-web:80']) {
  if (!caddy.includes(marker)) throw new Error(`Fase 7 Caddyfile is missing ${marker}`)
}
for (const forbidden of ['dokploy', 'worker-engine-m', 'scheduler:', 'prometheus:', 'grafana:', 'postgres:']) {
  if (compose.includes(forbidden)) throw new Error(`Legacy runtime marker remains in Fase 7 compose: ${forbidden}`)
}
if (compose.includes('editorial-redis') || compose.includes('REDIS_URL') || compose.includes('redis:')) throw new Error('Redis must not be present in the editorial runtime compose')
for (const marker of ['ghcr.io/leoalvespak-alt/prospector-platform-web:${IMAGE_TAG', 'ghcr.io/leoalvespak-alt/prospector-platform-migrations:${IMAGE_TAG', 'ghcr.io/leoalvespak-alt/rota-design-api:${IMAGE_TAG', 'ghcr.io/leoalvespak-alt/rota-design-web:${IMAGE_TAG', '127.0.0.1:8080:80']) {
  if (!productionCompose.includes(marker)) throw new Error(`Production compose is missing ${marker}`)
}
for (const forbidden of ['prospector-platform-worker', 'redis:', 'qdrant:', 'dokploy']) {
  if (productionCompose.includes(forbidden)) throw new Error(`Legacy production runtime marker remains: ${forbidden}`)
}
console.log('Editorial compose covers Prospector, Design and Caddy with PostgreSQL/PgBouncer endpoints and no resident queue service.')
