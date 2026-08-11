import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const credentialsPath = path.resolve(process.argv[2] ?? path.join(root, '..', 'CREDENCIAIS_VPS.txt'))
const credentials = Object.fromEntries(readFileSync(credentialsPath, 'utf8').split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$/)
  return match ? [[match[1].trim(), match[2].trim()]] : []
}))
const ipv4 = credentials.IPv4?.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0]
const userEntry = Object.entries(credentials).find(([key]) => /^Nome do usu.rio SSH$/i.test(key))?.[1]
const user = userEntry?.split(/\s+/)[0]
const configuredKey = credentials['Chave SSH']?.replace(/^['"]|['"]$/g, '')
const keyCandidates = [configuredKey, process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.ssh', 'id_rsa')].filter(Boolean)
const identityFile = keyCandidates.find((candidate) => existsSync(candidate))
if (!ipv4 || !user || !identityFile) throw new Error('Host, usuário ou chave SSH não foram encontrados nas credenciais')

const remote = `${user}@${ipv4}`
const sshBase = ['-i', identityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'StrictHostKeyChecking=accept-new', remote]
const container = `prospector-migration-check-${Date.now()}`
const composeDir = `/tmp/prospector-compose-check-${Date.now()}`
const password = randomBytes(24).toString('hex')

function ssh(command, input) {
  const result = spawnSync('ssh', [...sshBase, command], { input, encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `SSH command failed with status ${result.status}`)
  return result.stdout?.trim() ?? ''
}

try {
  const versions = ssh('docker version --format "{{.Server.Version}}"; docker compose version --short')
  if (!versions) throw new Error('Docker/Compose indisponível na VPS')
  ssh(`mkdir -p ${composeDir}/docker`)
  ssh(`cat > ${composeDir}/docker/docker-compose.yml`, readFileSync(path.join(root, 'docker', 'docker-compose.yml'), 'utf8'))
  ssh(`cat > ${composeDir}/docker/docker-compose.production.yml`, readFileSync(path.join(root, 'docker', 'docker-compose.production.yml'), 'utf8'))
  ssh(`cat > ${composeDir}/.env`, 'POSTGRES_DB=check\nPOSTGRES_USER=check\nPOSTGRES_PASSWORD=check\nDATABASE_URL=postgresql://check:check@postgres:5432/check\nREDIS_URL=redis://redis:6379\nEMBEDDINGS_MODEL=check\nAPP_URL=http://localhost\n')
  ssh(`cd ${composeDir} && docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.production.yml config --quiet`)
  ssh(`docker run -d --name ${container} -e POSTGRES_USER=platformcheck -e POSTGRES_PASSWORD=${password} -e POSTGRES_DB=multichannel_check pgvector/pgvector:pg16`)
  let healthy = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = spawnSync('ssh', [...sshBase, `docker exec ${container} pg_isready -U platformcheck -d multichannel_check`], { encoding: 'utf8', timeout: 15_000 })
    if (probe.status === 0) { healthy = true; break }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!healthy) throw new Error('PostgreSQL temporário não ficou pronto')

  const migrationsDir = path.join(root, 'packages', 'db', 'migrations')
  const upFiles = readdirSync(migrationsDir).filter((file) => file.endsWith('.up.sql')).sort()
  const latest = upFiles.at(-1)?.replace('.up.sql', '')
  if (!latest) throw new Error('Nenhuma migration encontrada')
  for (const file of upFiles) ssh(`docker exec -i ${container} psql -v ON_ERROR_STOP=1 -U platformcheck -d multichannel_check`, readFileSync(path.join(migrationsDir, file), 'utf8'))
  ssh(`docker exec -i ${container} psql -v ON_ERROR_STOP=1 -U platformcheck -d multichannel_check`, readFileSync(path.join(migrationsDir, `${latest}.down.sql`), 'utf8'))
  ssh(`docker exec -i ${container} psql -v ON_ERROR_STOP=1 -U platformcheck -d multichannel_check`, readFileSync(path.join(migrationsDir, `${latest}.up.sql`), 'utf8'))
  const invariant = ssh(`docker exec ${container} psql -v ON_ERROR_STOP=1 -U platformcheck -d multichannel_check -tAc "SELECT count(*) FROM campaigns WHERE name IN ('Rota de Ataque','Gazeta Concursos'); SELECT to_regclass('public.contact_policy_decisions') IS NOT NULL;"`)
  if (!/^2\s+.*t$/s.test(invariant)) throw new Error(`Invariantes de migration falharam: ${invariant}`)
  console.log(`Migration check aprovado: ${upFiles.length} migrations, rollback/reapply da ${latest} e Docker Compose ${versions.split(/\r?\n/).at(-1)}`)
} finally {
  spawnSync('ssh', [...sshBase, `docker rm -f ${container}`], { encoding: 'utf8', timeout: 30_000 })
  spawnSync('ssh', [...sshBase, `rm -rf ${composeDir}`], { encoding: 'utf8', timeout: 30_000 })
}
