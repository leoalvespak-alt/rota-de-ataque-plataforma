<#
Deploy atômico da Plataforma de Prospecção no VPS compartilhado.

O cutover inicial sobe Postgres, Redis, embeddings e web; workers, backups e
observabilidade permanecem atrás de profiles. O script valida que os containers
da Gazeta Concursos continuam os mesmos e saudáveis antes de concluir.
#>

param(
    [switch]$SkipChecks,
    [switch]$SkipBuild,
    [string]$IdentityFile = 'C:\Users\Lenovo\.ssh\id_rsa',
    [string]$CredentialsFile
)

$ErrorActionPreference = 'Stop'
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $PlatformRoot
if (-not $CredentialsFile) { $CredentialsFile = Join-Path $WorkspaceRoot 'CREDENCIAIS_VPS.txt' }
$RunId = (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$Archive = Join-Path $env:TEMP "prospector-platform-$RunId.tar"
$RemoteArchive = "/tmp/prospector-platform-$RunId.tar"

function Fail([string]$Message) { throw $Message }
function Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }

if (-not (Test-Path -LiteralPath $CredentialsFile -PathType Leaf)) { Fail 'CREDENCIAIS_VPS.txt não encontrado.' }
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { Fail "Chave SSH não encontrada: $IdentityFile" }

$Credentials = @{}
Get-Content -LiteralPath $CredentialsFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$') { $Credentials[$matches[1].Trim()] = $matches[2].Trim() }
}
$HostMatch = [regex]::Match($Credentials['IPv4'], '\b(?:\d{1,3}\.){3}\d{1,3}\b')
if (-not $HostMatch.Success) { Fail 'IPv4 inválido no arquivo de credenciais.' }
$VpsHost = $HostMatch.Value
$UserEntry = $Credentials.GetEnumerator() | Where-Object { $_.Key -match '^Nome do usu.*rio SSH$' } | Select-Object -First 1
if (-not $UserEntry) { Fail 'Nome do usuário SSH ausente nas credenciais.' }
$VpsUser = ([string]$UserEntry.Value -split '\s+')[0]
if ($VpsUser -notmatch '^[a-zA-Z0-9_-]+$') { Fail 'Usuário SSH inválido.' }
$Remote = "$VpsUser@$VpsHost"
$SshOptions = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

function Invoke-Remote([string]$Script, [string[]]$Arguments) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    $quoted = ($Arguments | ForEach-Object { "'$_'" }) -join ' '
    & ssh @SshOptions $Remote "printf '%s' '$encoded' | base64 --decode | bash -s -- $quoted"
    if ($LASTEXITCODE -ne 0) { Fail 'Deploy remoto falhou; o cutover não foi concluído.' }
}

try {
    Set-Location $PlatformRoot
    Step 'Empacotando apenas o código-fonte, sem build local, caches ou segredos'
    & tar -cf $Archive --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='dist' --exclude='.turbo' --exclude='*.tsbuildinfo' --exclude='baseline/2026-08-08' --exclude='baseline/package-lock.json.pre-pnpm.bak' --exclude='.env*' -C $PlatformRoot .
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao criar pacote de release.' }

    Step 'Enviando release ao VPS'
    & scp @SshOptions $Archive "${Remote}:$RemoteArchive"
    if ($LASTEXITCODE -ne 0) { Fail 'Upload da release falhou.' }

    Step 'Construindo containers, aplicando migration e validando Rota + Gazeta'
    $RemoteScript = @'
set -euo pipefail
run_id="$1"
archive="$2"
root=/opt/prospector-platform
release="$root/releases/$run_id"
shared="$root/shared"
mkdir -p "$release" "$shared" "$root/releases"
tar -xf "$archive" -C "$release"
rm -f "$archive"
test -f "$release/docker/docker-compose.yml"
test -f "$release/packages/db/migrations/0001_initial.up.sql"
test -f "$release/packages/db/migrations/0002_intelligence_base.up.sql"

gazeta_n8n_before="$(docker inspect -f '{{.Id}}' gazeta-n8n)"
gazeta_worker_before="$(docker inspect -f '{{.Id}}' gazeta-worker)"
test "$(docker inspect -f '{{.State.Running}}' gazeta-n8n)" = true
test "$(docker inspect -f '{{.State.Running}}' gazeta-worker)" = true

if [ ! -f "$shared/.env" ]; then
  umask 077
  pg_password="$(openssl rand -hex 24)"
  nextauth_secret="$(openssl rand -base64 48 | tr -d '\n')"
  otp_secret="$(openssl rand -base64 32 | tr -d '\n')"
  token_key="$(openssl rand -base64 32 | tr -d '\n')"
  backup_key="$(openssl rand -base64 48 | tr -d '\n')"
  pii_hash_salt="$(openssl rand -hex 32)"
  cat > "$shared/.env" <<EOF
POSTGRES_DB=prospector
POSTGRES_USER=prospector
POSTGRES_PASSWORD=$pg_password
DATABASE_URL=postgresql://prospector:$pg_password@postgres:5432/prospector
REDIS_URL=redis://redis:6379
EMBEDDINGS_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDINGS_ENDPOINT=http://embeddings:8080
EMBEDDING_DIM=384
APP_URL=https://design.rotadeataque.com.br/prospector
NEXTAUTH_URL=https://design.rotadeataque.com.br/prospector
NEXTAUTH_SECRET=$nextauth_secret
OTP_SECRET=$otp_secret
TOKEN_ENCRYPTION_KEY=$token_key
NEXT_PUBLIC_BASE_PATH=/prospector
BACKUP_ENCRYPTION_KEY=$backup_key
PII_HASH_SALT=$pii_hash_salt
NODE_ENV=production
LOG_LEVEL=info
TZ=America/Sao_Paulo
WORKERS_DEFAULT_ENABLED=false
MIGRATIONS_CURRENT=true
META_TOKEN_VALID=false
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-6
EOF
fi
ensure_env() { key="$1"; value="$2"; grep -q "^${key}=" "$shared/.env" || printf '%s=%s\n' "$key" "$value" >> "$shared/.env"; }
ensure_env MIGRATIONS_CURRENT true
ensure_env META_TOKEN_VALID false
ensure_env LLM_PROVIDER anthropic
ensure_env LLM_MODEL claude-sonnet-4-6
ensure_env LLM_API_KEY ''
ensure_env META_APP_ID ''
ensure_env META_APP_SECRET ''
ensure_env META_ACCESS_TOKEN ''
ensure_env THREADS_ACCESS_TOKEN ''
ensure_env REDDIT_CLIENT_ID ''
ensure_env REDDIT_CLIENT_SECRET ''
ensure_env REDDIT_REFRESH_TOKEN ''
ensure_env REDDIT_USER_AGENT ''
ensure_env WHATSAPP_PHONE_NUMBER_ID ''
ensure_env WHATSAPP_BUSINESS_ACCOUNT_ID ''
ensure_env WHATSAPP_ACCESS_TOKEN ''
ensure_env WHATSAPP_WEBHOOK_VERIFY_TOKEN ''
ensure_env WHATSAPP_APP_SECRET ''
ensure_env WHATSAPP_GROUPS_AVAILABLE false
ensure_env EMAIL_FROM 'Rota de Ataque <contato@example.com>'
ensure_env RESEND_API_KEY ''
ensure_env RESEND_WEBHOOK_SECRET ''
ensure_env EMAIL_SES_WEBHOOK_SECRET ''
ensure_env AWS_REGION us-east-1
ensure_env AWS_ACCESS_KEY_ID ''
ensure_env AWS_SECRET_ACCESS_KEY ''
ensure_env WORKER_REDDIT_INTELLIGENCE_ENABLED false
ensure_env WORKER_THREADS_ADAPTER_ENABLED false
ensure_env WORKER_THREADS_PUBLISHER_ENABLED false
ensure_env WORKER_EMAIL_FLOW_ENGINE_ENABLED false
ensure_env WORKER_EMAIL_EVENTS_CONSUMER_ENABLED false
ensure_env WORKER_WHATSAPP_INBOUND_ENABLED false
ensure_env WORKER_WHATSAPP_OUTBOUND_ENABLED false
ensure_env WORKER_WHATSAPP_GROUP_MANAGER_ENABLED false
ensure_env WORKER_IDENTITY_RESOLVER_ENABLED false
ensure_env WORKER_NEXT_BEST_CHANNEL_ENABLED false
ensure_env WORKER_CONTACT_POLICY_ENGINE_ENABLED false
ensure_env SOURCE_ROI_AUTOAPPLY false
ensure_env AUTH_BOOTSTRAP_VIEWER true
grep -q '^PII_HASH_SALT=.' "$shared/.env" || sed -i "s/^PII_HASH_SALT=.*/PII_HASH_SALT=$(openssl rand -hex 32)/" "$shared/.env"
ln -sfn "$shared/.env" "$release/.env"
cd "$release"
dc() { docker compose --env-file .env -p prospector-platform -f docker/docker-compose.yml -f docker/docker-compose.production.yml "$@"; }
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1

dc config --quiet
if [ "$4" != 1 ]; then
  printf 'Build remoto iniciado no VPS (web + imagem-base dos workers/migrations).\n'
  dc build --pull web migrate
fi
if [ "$3" = 1 ]; then
  dc run --rm --no-deps -T migrate sh -lc 'pnpm check:runtime-deps && pnpm check:hashes' </dev/null
fi
dc up -d postgres redis embeddings

wait_healthy() {
  service="$1"
  limit="$2"
  elapsed=0
  while [ "$elapsed" -lt "$limit" ]; do
    cid="$(dc ps -q "$service")"
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
    [ "$status" = healthy ] && return 0
    [ "$status" = exited ] && return 1
    sleep 10
    elapsed=$((elapsed + 10))
  done
  return 1
}

wait_healthy postgres 180
wait_healthy redis 180
wait_healthy embeddings 900

dc run --rm -T migrate </dev/null
latest_migration="$(dc exec -T postgres psql -U prospector -d prospector -tAc "SELECT max(version) FROM schema_migrations" </dev/null)"
expected_migration="$(find packages/db/migrations -maxdepth 1 -type f -name '*.up.sql' -printf '%f\n' | sort | tail -n 1 | sed 's/\.up\.sql$//')"
test -n "$expected_migration"
test "${latest_migration//[[:space:]]/}" = "$expected_migration"

campaigns="$(dc exec -T postgres psql -U prospector -d prospector -tAc "SELECT count(*) FROM campaigns WHERE name IN ('Rota de Ataque','Gazeta Concursos')" </dev/null)"
test "${campaigns//[[:space:]]/}" = 2

web_image="$(docker image inspect -f '{{.Id}}' prospector-platform-web:latest)"
dc up -d --force-recreate --no-deps web
wait_healthy web 300
web_container="$(dc ps -q web)"
test "$(docker inspect -f '{{.Image}}' "$web_container")" = "$web_image"
curl --fail --silent --show-error http://127.0.0.1:3010/prospector/api/health | grep -q '"ok":true'

nginx_file=/etc/nginx/sites-available/design.rotadeataque.com.br
if ! grep -q 'prospector-platform' "$nginx_file"; then
  cp "$nginx_file" "$nginx_file.before-prospector-$run_id"
  python3 - "$nginx_file" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); text=p.read_text()
needle='  location / {\n'
block='  # prospector-platform\n  location ^~ /prospector {\n    proxy_pass http://127.0.0.1:3010;\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n\n'
if needle not in text: raise SystemExit('location raiz do nginx não encontrada')
p.write_text(text.replace(needle,block+needle,1))
PY
  if ! nginx -t; then
    mv "$nginx_file.before-prospector-$run_id" "$nginx_file"
    exit 1
  fi
  systemctl reload nginx
fi

test "$(docker inspect -f '{{.Id}}' gazeta-n8n)" = "$gazeta_n8n_before"
test "$(docker inspect -f '{{.Id}}' gazeta-worker)" = "$gazeta_worker_before"
test "$(docker inspect -f '{{.State.Running}}' gazeta-n8n)" = true
test "$(docker inspect -f '{{.State.Running}}' gazeta-worker)" = true

ln -sfn "$release" "$root/current"
find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r rm -rf
printf 'Deploy concluído: duas campanhas, dependências saudáveis e Gazeta preservada.\n'
'@
    $RunRemoteChecks = if ($SkipChecks) { '0' } else { '1' }
    $ReuseRemoteBuild = if ($SkipBuild) { '1' } else { '0' }
    Invoke-Remote $RemoteScript @($RunId, $RemoteArchive, $RunRemoteChecks, $ReuseRemoteBuild)
    & ssh @SshOptions $Remote "test -L /opt/prospector-platform/current && curl --fail --silent --output /dev/null http://127.0.0.1:3010/prospector/api/health"
    if ($LASTEXITCODE -ne 0) { Fail 'Verificação independente do cutover falhou.' }
    Step 'Deploy concluído'
    Write-Host 'Plataforma: https://design.rotadeataque.com.br/prospector' -ForegroundColor Green
}
finally {
    if (Test-Path -LiteralPath $Archive) { Remove-Item -LiteralPath $Archive -Force -ErrorAction SilentlyContinue }
}
