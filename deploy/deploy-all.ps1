<#
Deploy unificado — Design System + Prospector (Plataforma)

Publica o sistema completo no VPS compartilhado em uma única execução:
  1. Design System (Vite SPA) → /var/www/design-rota-ataque (nginx estático)
  2. Prospector (Next.js + workers) → /opt/prospector-platform (Docker Compose)

O build do Design System é local (Vite, ~15s). O build do Prospector é remoto
no VPS (Docker build, evita enviar node_modules e alivia o PC local).

Uso:
  .\deploy\deploy-all.ps1                        # deploy completo
  .\deploy\deploy-all.ps1 -Only design           # só Design System
  .\deploy\deploy-all.ps1 -Only prospector       # só Prospector
  .\deploy\deploy-all.ps1 -SkipBuild             # pula build local (design) e remoto (prospector)

Pré-requisitos:
  - Chave SSH (~\.ssh\id_rsa) autorizada no VPS
  - .env.production em plataforma/ (fonte de credenciais; substitui CREDENCIAIS_VPS.txt)
  - Node.js, pnpm, tar, ssh, scp no PATH
#>

param(
    [ValidateSet('all', 'design', 'prospector')]
    [string]$Only = 'all',
    [switch]$SkipBuild,
    [switch]$ReuseWorkerImage,
    [string]$IdentityFile = 'C:\Users\Lenovo\.ssh\id_rsa',
    [string]$EnvProductionFile,
    [string]$CredentialsFile
)

$ErrorActionPreference = 'Stop'

$PlatformRoot  = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $PlatformRoot
$DesignRoot    = Join-Path $PlatformRoot 'apps\design-system'

if (-not $EnvProductionFile) { $EnvProductionFile = Join-Path $PlatformRoot '.env.production' }
if (-not $CredentialsFile)   { $CredentialsFile   = Join-Path $WorkspaceRoot 'CREDENCIAIS_VPS.txt' }

$RunId = (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)

function Fail([string]$Message) { throw $Message }
function Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Ok([string]$Message)   { Write-Host "    $Message"   -ForegroundColor Green }

# ── Lê credenciais ──────────────────────────────────────────────────────────

# 1. Parse .env.production (fonte primária)
$EnvProd = @{}
if (Test-Path -LiteralPath $EnvProductionFile -PathType Leaf) {
    Get-Content -LiteralPath $EnvProductionFile -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*([^#=\r\n]+?)\s*=\s*(.*?)\s*$') {
            $EnvProd[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
} else {
    Write-Host "    Aviso: $EnvProductionFile não encontrado — usando CREDENCIAIS_VPS.txt como fallback." -ForegroundColor Yellow
}

# 2. Resolve host/user — .env.production tem prioridade; fallback para CREDENCIAIS_VPS.txt
if ($EnvProd.ContainsKey('VPS_HOST') -and $EnvProd['VPS_HOST'] -ne '') {
    $VpsHost = $EnvProd['VPS_HOST']
    $VpsUser = if ($EnvProd.ContainsKey('VPS_USER') -and $EnvProd['VPS_USER'] -ne '') { $EnvProd['VPS_USER'] } else { 'root' }
} else {
    if (-not (Test-Path -LiteralPath $CredentialsFile -PathType Leaf)) {
        Fail "Nenhuma fonte de credenciais encontrada. Configure VPS_HOST em $EnvProductionFile ou mantenha $CredentialsFile"
    }
    $Creds = @{}
    Get-Content -LiteralPath $CredentialsFile -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$') { $Creds[$matches[1].Trim()] = $matches[2].Trim() }
    }
    $HostMatch = [regex]::Match($Creds['IPv4'], '\b(?:\d{1,3}\.){3}\d{1,3}\b')
    if (-not $HostMatch.Success) { Fail 'IPv4 inválido no arquivo de credenciais.' }
    $VpsHost = $HostMatch.Value
    $UserEntry = $Creds.GetEnumerator() | Where-Object { $_.Key -match '^Nome do usu.*rio SSH$' } | Select-Object -First 1
    if (-not $UserEntry) { Fail 'Nome do usuário SSH ausente nas credenciais.' }
    $VpsUser = ([string]$UserEntry.Value -split '\s+')[0]
    if ($VpsUser -notmatch '^[a-zA-Z0-9_-]+$') { Fail 'Usuário SSH inválido.' }
}

if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { Fail "Chave SSH não encontrada: $IdentityFile" }

$Remote  = "$VpsUser@$VpsHost"
$SshOpts = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

function Ssh([string]$Command) {
    & ssh.exe @SshOpts $Remote $Command
    if ($LASTEXITCODE -ne 0) { Fail "Comando remoto falhou: $Command" }
}

function SshScript([string]$Script, [string[]]$Arguments = @()) {
    $normalized    = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
    $encoded       = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalized))
    $quoted        = ($Arguments | ForEach-Object { "'$_'" }) -join ' '
    $remoteScript  = "/tmp/rota-deploy-$([guid]::NewGuid().ToString('N')).sh"
    & ssh.exe @SshOpts $Remote "printf '%s' '$encoded' | base64 --decode > '$remoteScript'; bash '$remoteScript' $quoted; rc=`$?; rm -f '$remoteScript'; exit `$rc"
    if ($LASTEXITCODE -ne 0) { Fail 'Script remoto falhou.' }
}

# Serializa vars selecionadas de $EnvProd como fragmento base64 para merge no VPS.
# Só inclui chaves com valor não-vazio.
function Get-EnvFragment([string[]]$Keys) {
    $lines = @()
    foreach ($key in $Keys) {
        if ($EnvProd.ContainsKey($key) -and $EnvProd[$key] -ne '') {
            $lines += "$key=$($EnvProd[$key])"
        }
    }
    if ($lines.Count -eq 0) { return '' }
    $text = $lines -join "`n"
    return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))
}

# Snippet bash reutilizável que faz merge do fragmento base64 no arquivo .env do VPS.
# Preserva comentários e ordem. Só sobrescreve chaves presentes no fragmento com valor não-vazio.
$MergeEnvSnippet = @'
_merge_env_frag() {
  local frag_b64="$1" env_file="$2"
  [ -z "$frag_b64" ] && return 0
  local tmp="/tmp/env-frag-$$.txt"
  printf '%s' "$frag_b64" | base64 --decode > "$tmp"
  python3 - "$env_file" "$tmp" <<'PY'
import sys
from pathlib import Path
def kv(t):
    d = {}
    for l in t.splitlines():
        s = l.strip()
        if s and not s.startswith('#') and '=' in s:
            k, _, v = s.partition('=')
            d[k.strip()] = v
    return d
u = {k: v for k, v in kv(Path(sys.argv[2]).read_text()).items() if v}
ep = Path(sys.argv[1])
ex = ep.read_text() if ep.exists() else ''
out = []; seen = set()
for l in ex.splitlines():
    s = l.strip()
    if s and not s.startswith('#') and '=' in s:
        k = s.partition('=')[0].strip()
        if k in u:
            out.append(f'{k}={u[k]}'); seen.add(k); continue
    out.append(l)
for k, v in u.items():
    if k not in seen:
        out.append(f'{k}={v}')
ep.write_text('\n'.join(out) + '\n')
PY
  rm -f "$tmp"
}
'@

Step 'Preflight SSH'
Ssh 'echo "SSH OK: $(hostname) $(date)"'
Ok 'Conexão estabelecida'

# ── 1. DESIGN SYSTEM ────────────────────────────────────────────────────────

if ($Only -in 'all', 'design') {
    Step 'Design System: verificando diretório remoto'
    Ssh 'test -d /var/www/design-rota-ataque && test -f /var/www/design-rota-ataque/index.html'
    Ok '/var/www/design-rota-ataque existe'

    # Vars do Design System a sincronizar para o VPS
    $DesignEnvFragment = Get-EnvFragment @(
        'DESIGN_API_PASSWORD',
        'DESIGN_WEB_ORIGIN',
        'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL',
        'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_MODEL_PRO', 'DEEPSEEK_BASE_URL',
        'FAL_API_KEY',
        'AI_FALLBACK_TIMEOUT_MS', 'AI_EMBEDDING_LOCAL_FALLBACK_ENABLED',
        'ZAI_API_KEY', 'ZAI_MODEL', 'ZAI_BASE_URL',
        'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'NVIDIA_BASE_URL',
        'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL',
        'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'MISTRAL_BASE_URL',
        'OPENCODE_GO_API_KEY', 'OPENCODE_GO_MODEL', 'OPENCODE_GO_BASE_URL',
        'WAFER_API_KEY', 'WAFER_MODEL', 'WAFER_BASE_URL',
        'KIMI_API_KEY', 'KIMI_MODEL', 'KIMI_BASE_URL',
        'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'CEREBRAS_BASE_URL'
    )

    Step 'Design API: empacotando release imutável'
    $DesignSourceArchive       = Join-Path $env:TEMP "design-api-$RunId.tar"
    $DesignSourceRemoteArchive = "/tmp/design-api-$RunId.tar"
    Set-Location $PlatformRoot
    & tar -cf $DesignSourceArchive --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.env*' --exclude='*.tsbuildinfo' -C $PlatformRoot package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc apps/design-system
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao empacotar a Design API.' }
    & scp @SshOpts $DesignSourceArchive "${Remote}:$DesignSourceRemoteArchive"
    if ($LASTEXITCODE -ne 0) { Fail 'Upload da Design API falhou.' }

    Step 'Design API: backup, build, migrations e rollout'
    $designApiDeploy = $MergeEnvSnippet + @'

set -euo pipefail
run_id="$1"
archive="$2"
env_fragment="$3"
root=/opt/rota-design-api
release="$root/releases/$run_id"
shared="$root/shared"
mkdir -p "$release" "$shared" "$root/releases" "$shared/backups"
tar -xf "$archive" -C "$release"
rm -f "$archive"
test -f "$release/apps/design-system/docker-compose.yml"

if [ ! -f "$shared/.env" ]; then
  umask 077
  cat > "$shared/.env" <<EOF
DESIGN_POSTGRES_PASSWORD=$(openssl rand -hex 24)
DESIGN_API_SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
DESIGN_API_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
DESIGN_API_AUTH_TOKEN=$(openssl rand -base64 36 | tr -d '\n')
DESIGN_WEB_ORIGIN=https://design.rotadeataque.com.br
TRUST_PROXY=true
DESIGN_MIGRATION_BASELINE_EXISTING=false
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
FAL_API_KEY=
EOF
fi
chmod 600 "$shared/.env"

# Merge credenciais do .env.production local (sobrescreve somente chaves não-vazias)
_merge_env_frag "$env_fragment" "$shared/.env"

printf 'RELEASE_ID=%s\nDESIGN_API_IMAGE=rota-design-api:%s\n' "$run_id" "$run_id" > "$release/.release.env"
cat "$shared/.env" "$release/.release.env" > "$release/.env"
chmod 600 "$release/.env"

cd "$release"
dc() { docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml "$@"; }
dc config --quiet
dc up -d postgres redis

for service in postgres redis; do
  elapsed=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q "$service")" 2>/dev/null || true)" = healthy ]; do
    sleep 5; elapsed=$((elapsed + 5)); [ "$elapsed" -lt 180 ] || exit 1
  done
done

if dc exec -T postgres psql -U rota_design -d rota_design -tAc "select to_regclass('public.design_schema_migrations')" | grep -q design_schema_migrations; then
  dc exec -T postgres pg_dump -U rota_design -d rota_design -Fc > "$shared/backups/before-$run_id.dump"
  test -s "$shared/backups/before-$run_id.dump"
fi

docker build --pull -t "rota-design-api:$run_id" -f apps/design-system/Dockerfile.api .
dc run --rm -T migrate </dev/null
dc up -d --force-recreate --no-deps api

elapsed=0
until curl --fail --silent http://127.0.0.1:3002/health | grep -q '"status":"ok"'; do
  sleep 5; elapsed=$((elapsed + 5)); [ "$elapsed" -lt 180 ] || { dc logs --tail=100 api; exit 1; }
done

nginx_file=/etc/nginx/sites-available/design.rotadeataque.com.br
cp "$nginx_file" "$nginx_file.before-design-api-$run_id"
python3 - "$nginx_file" <<'PY'
from pathlib import Path
import re
import sys
p = Path(sys.argv[1])
text = p.read_text()
needle = '  location / {\n'
block = '''  # rota-design-api
  location ^~ /api/ {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 65s;
    client_max_body_size 2m;
  }

'''
pattern = re.compile(r'(?ms)^  (?:# rota-design-api\n  )?location (?:\^~ )?/api/ \{.*?^  \}\n\n?')
if pattern.search(text):
    text = pattern.sub(block, text, count=1)
elif needle in text:
    text = text.replace(needle, block + needle, 1)
else:
    raise SystemExit('location raiz do nginx não encontrada')
p.write_text(text)
PY
nginx -t || { mv "$nginx_file.before-design-api-$run_id" "$nginx_file"; exit 1; }
systemctl reload nginx

curl --fail --silent https://design.rotadeataque.com.br/api/health | grep -q '"status":"ok"'
api_cid="$(dc ps -q api)"
test -n "$api_cid"
test "$(docker inspect -f '{{.State.Health.Status}}' "$api_cid")" = healthy
test "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$api_cid")" = api
ln -sfn "$release" "$root/current"
find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r rm -rf
find "$shared/backups" -type f -printf '%T@ %p\n' | sort -nr | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f
'@
    SshScript $designApiDeploy @($RunId, $DesignSourceRemoteArchive, $DesignEnvFragment)
    Ok 'Design API saudável e migrations aplicadas'

    $DesignDist = Join-Path $DesignRoot 'dist'

    if (-not $SkipBuild) {
        Step 'Design System: build local (Vite)'
        Set-Location $DesignRoot
        & pnpm run build
        if ($LASTEXITCODE -ne 0) { Fail 'Build do Design System falhou.' }
        Set-Location $PlatformRoot
    }

    if (-not (Test-Path -LiteralPath (Join-Path $DesignDist 'index.html') -PathType Leaf)) {
        Fail 'dist/index.html do Design System não existe. Rode sem -SkipBuild.'
    }

    Step 'Design System: empacotando e enviando'
    $DesignArchive       = Join-Path $env:TEMP "design-dist-$RunId.tar.gz"
    $DesignRemoteArchive = "/tmp/design-dist-$RunId.tar.gz"
    & tar -czf $DesignArchive -C $DesignDist .
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao empacotar dist/ do Design System.' }
    & scp @SshOpts $DesignArchive "${Remote}:$DesignRemoteArchive"
    if ($LASTEXITCODE -ne 0) { Fail 'Upload do Design System falhou.' }

    Step 'Design System: swap atômico no VPS'
    $designSwap = @'
set -euo pipefail
archive="$1"
target="/var/www/design-rota-ataque"
stage="${target}.staging-$$"
backup="${target}.previous-$$"
cleanup() { rm -rf "$stage" "$archive"; }
rollback() { s=$?; [ -d "$backup" ] && rm -rf "$target" && mv "$backup" "$target" && nginx -t && systemctl reload nginx || true; cleanup; exit "$s"; }
trap rollback ERR
mkdir -p "$stage"
tar -xzf "$archive" -C "$stage"
test -f "$stage/index.html"
chown -R www-data:www-data "$stage"
find "$stage" -type d -exec chmod 755 {} +
find "$stage" -type f -exec chmod 644 {} +
nginx -t
mv "$target" "$backup"
mv "$stage" "$target"
nginx -t && systemctl reload nginx
rm -rf "$backup"
cleanup
trap - ERR
printf 'Design System publicado.\n'
'@
    SshScript $designSwap @($DesignRemoteArchive)
    Ok 'Design System atualizado: https://design.rotadeataque.com.br'

    if (Test-Path -LiteralPath $DesignArchive)       { Remove-Item -LiteralPath $DesignArchive       -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $DesignSourceArchive) { Remove-Item -LiteralPath $DesignSourceArchive -Force -ErrorAction SilentlyContinue }
}

# ── 2. PROSPECTOR (Plataforma) ──────────────────────────────────────────────

if ($Only -in 'all', 'prospector') {
    Step 'Prospector: verificando infra Gazeta'
    Ssh 'docker inspect -f "{{.State.Running}}" gazeta-n8n | grep -q true && docker inspect -f "{{.State.Running}}" gazeta-worker | grep -q true'
    Ok 'Gazeta Concursos saudável'

    # Vars do Prospector a sincronizar para o VPS (integrações externas + config)
    # NÃO inclui segredos gerados no VPS: POSTGRES_PASSWORD, NEXTAUTH_SECRET, OTP_SECRET, TOKEN_ENCRYPTION_KEY, etc.
    $ProspectorEnvFragment = Get-EnvFragment @(
        'APP_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_BASE_PATH',
        'AUTH_ADMIN_EMAILS', 'AUTH_OPERATOR_EMAILS', 'AUTH_BOOTSTRAP_VIEWER',
        'META_APP_ID', 'META_APP_SECRET', 'META_WEBHOOK_VERIFY_TOKEN',
        'META_ACCESS_TOKEN', 'META_PAGE_ACCESS_TOKEN', 'META_INSTAGRAM_ACCESS_TOKEN',
        'META_BUSINESS_ACCOUNT_ID', 'META_INSTAGRAM_ACCOUNT_ID', 'META_FACEBOOK_PAGE_ID',
        'META_API_VERSION', 'META_GRAPH_BASE_URL', 'META_TOKEN_VALID',
        'THREADS_ACCESS_TOKEN',
        'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USER_AGENT', 'REDDIT_REFRESH_TOKEN',
        'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_GROUPS_AVAILABLE',
        'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'EMAIL_UNSUBSCRIBE_SECRET',
        'EMAIL_FROM', 'RESEND_FROM', 'ALERTS_EMAIL_TO',
        'ALERT_EMAIL_FROM', 'ALERT_EMAIL_TO', 'ALERTS_EMAIL_ESCALATION_TO',
        'EMAIL_SES_WEBHOOK_SECRET', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
        'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_ENDPOINT', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY',
        'AI_FALLBACK_TIMEOUT_MS', 'AI_EMBEDDING_LOCAL_FALLBACK_ENABLED',
        'DEEPSEEK_MODEL_PRO', 'DEEPSEEK_BASE_URL',
        'ZAI_API_KEY', 'ZAI_MODEL', 'ZAI_BASE_URL',
        'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'NVIDIA_BASE_URL',
        'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL',
        'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'MISTRAL_BASE_URL',
        'OPENCODE_GO_API_KEY', 'OPENCODE_GO_MODEL', 'OPENCODE_GO_BASE_URL',
        'WAFER_API_KEY', 'WAFER_MODEL', 'WAFER_BASE_URL',
        'KIMI_API_KEY', 'KIMI_MODEL', 'KIMI_BASE_URL',
        'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'CEREBRAS_BASE_URL',
        'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID',
        'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
        'S3_ACCESS_KEY', 'S3_SECRET_KEY',
        'S3_BUCKET', 'S3_BUCKET_SNAPSHOTS', 'S3_BUCKET_BACKUPS',
        'S3_PUBLIC_BUCKET', 'S3_PUBLIC_BASE_URL',
        'SENTRY_DSN',
        'EXA_ENABLED', 'EXA_API_KEY',
        'APIFY_ENABLED', 'APIFY_API_TOKEN',
        'APIFY_INSTAGRAM_ACTOR_ID', 'APIFY_TIKTOK_ACTOR_ID', 'APIFY_YOUTUBE_ACTOR_ID',
        'BRIGHT_DATA_ENABLED', 'BRIGHT_DATA_API_KEY', 'BRIGHT_DATA_DATASET_ID',
        'ORGANIC_DEEP_ANALYSIS_ENABLED', 'ORGANIC_AUTO_GENERATION_ENABLED',
        'ORGANIC_AUTO_SCHEDULING_ENABLED', 'ORGANIC_LEARNING_RECOMMENDATIONS_ENABLED',
        'WORKER_META_SYNC_ENABLED', 'WORKER_META_WEBHOOK_CONSUMER_ENABLED',
        'WORKER_REDDIT_INTELLIGENCE_ENABLED', 'WORKER_THREADS_ADAPTER_ENABLED',
        'WORKER_THREADS_PUBLISHER_ENABLED', 'WORKER_EMAIL_FLOW_ENGINE_ENABLED',
        'WORKER_EMAIL_EVENTS_CONSUMER_ENABLED', 'WORKER_WHATSAPP_INBOUND_ENABLED',
        'WORKER_WHATSAPP_OUTBOUND_ENABLED', 'WORKER_IDENTITY_RESOLVER_ENABLED',
        'WORKER_NEXT_BEST_CHANNEL_ENABLED', 'WORKER_CONTACT_POLICY_ENGINE_ENABLED',
        'WORKER_ALERTS_ENABLED', 'WORKER_PUBLISHER_ENABLED',
        'WORKER_CONTENT_ITEM_ORCHESTRATOR_ENABLED', 'SOURCE_ROI_AUTOAPPLY'
    )

    Step 'Prospector: empacotando código-fonte'
    $PlatformArchive       = Join-Path $env:TEMP "prospector-platform-$RunId.tar"
    $PlatformRemoteArchive = "/tmp/prospector-platform-$RunId.tar"
    Set-Location $PlatformRoot
    & tar -cf $PlatformArchive --exclude='node_modules' --exclude='.git' --exclude='.next' --exclude='dist' --exclude='.turbo' --exclude='*.tsbuildinfo' --exclude='baseline/2026-08-08' --exclude='baseline/package-lock.json.pre-pnpm.bak' --exclude='.env' --exclude='.env.local' --exclude='.env.production' -C $PlatformRoot .
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao empacotar a plataforma.' }

    Step 'Prospector: enviando ao VPS'
    & scp @SshOpts $PlatformArchive "${Remote}:$PlatformRemoteArchive"
    if ($LASTEXITCODE -ne 0) { Fail 'Upload da plataforma falhou.' }

    Step 'Prospector: build remoto + migrations + deploy (Docker no VPS)'
    $prospectorScript = $MergeEnvSnippet + @'

set -euo pipefail
run_id="$1"
archive="$2"
skip_build="$3"
reuse_worker_image="$4"
env_fragment="$5"
root=/opt/prospector-platform
release="$root/releases/$run_id"
shared="$root/shared"
mkdir -p "$release" "$shared" "$root/releases"
tar -xf "$archive" -C "$release"
rm -f "$archive"

test -f "$release/docker/docker-compose.yml"

gazeta_n8n_before="$(docker inspect -f '{{.Id}}' gazeta-n8n)"
gazeta_worker_before="$(docker inspect -f '{{.Id}}' gazeta-worker)"

# Shared .env (gera na primeira vez, preserva nas seguintes)
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
NEXTAUTH_URL=https://design.rotadeataque.com.br/prospector/api/auth
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
LLM_MODEL=claude-sonnet-4-20250514
EOF
fi

# Merge credenciais do .env.production local (sobrescreve somente chaves não-vazias)
_merge_env_frag "$env_fragment" "$shared/.env"

ensure_env() { grep -q "^${1}=" "$shared/.env" || printf '%s=%s\n' "$1" "$2" >> "$shared/.env"; }
ensure_env MIGRATIONS_CURRENT true
ensure_env META_TOKEN_VALID false
ensure_env AUTH_BOOTSTRAP_VIEWER false
if [ "$reuse_worker_image" != "1" ]; then
  sed -i '/^WORKER_IMAGE=/d' "$shared/.env"
  printf 'WORKER_IMAGE=prospector-platform-worker:%s\n' "$run_id" >> "$shared/.env"
fi
ensure_env EXA_ENABLED false
ensure_env APIFY_ENABLED false
ensure_env BRIGHT_DATA_ENABLED false
ensure_env ORGANIC_DEEP_ANALYSIS_ENABLED false
ensure_env ORGANIC_AUTO_GENERATION_ENABLED false
ensure_env ORGANIC_AUTO_SCHEDULING_ENABLED false
ensure_env ORGANIC_LEARNING_RECOMMENDATIONS_ENABLED false
while IFS='=' read -r worker_flag _; do ensure_env "$worker_flag" false; done < <(grep -E '^WORKER_[A-Z0-9_]+_ENABLED=' "$release/.env.example")

ln -sfn "$shared/.env" "$release/.env"
cd "$release"
dc() { docker compose --env-file .env -p prospector-platform -f docker/docker-compose.yml -f docker/docker-compose.production.yml "$@"; }
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1

dc config --quiet

# Build remoto (no VPS, não no PC local)
if [ "$skip_build" != "1" ] && [ "$reuse_worker_image" != "1" ]; then
  printf 'Build remoto no VPS (Docker)...\n'
  dc build --pull web migrate
elif [ "$reuse_worker_image" = "1" ]; then
  current_worker_image="$(grep '^WORKER_IMAGE=' "$shared/.env" | tail -n1 | cut -d= -f2-)"
  test -n "$current_worker_image"
  docker image inspect "$current_worker_image" >/dev/null
  printf 'Reutilizando imagem validada de workers: %s\n' "$current_worker_image"
  dc build --pull web
fi

# Infra base
dc up -d postgres redis embeddings

wait_healthy() {
  svc="$1"; limit="$2"; elapsed=0
  while [ "$elapsed" -lt "$limit" ]; do
    cid="$(dc ps -q "$svc")"
    st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
    [ "$st" = healthy ] && return 0
    [ "$st" = exited ] && return 1
    sleep 10; elapsed=$((elapsed + 10))
  done
  return 1
}

wait_healthy postgres 180
wait_healthy redis 180
wait_healthy embeddings 900

# Migrations
printf 'Aplicando migrations pendentes...\n'
backup_dir="$shared/backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_file="$backup_dir/pre-migration-$run_id.dump"
dc exec -T postgres pg_dump -U prospector -d prospector -Fc > "$backup_file"
test -s "$backup_file"
printf "Backup pré-migration OK: %s\n" "$backup_file"
dc run --rm -T migrate </dev/null
latest="$(dc exec -T postgres psql -U prospector -d prospector -tAc "SELECT max(version) FROM schema_migrations" </dev/null)"
expected="$(find packages/db/migrations -maxdepth 1 -type f -name '*.up.sql' -printf '%f\n' | sort | tail -n 1 | sed 's/\.up\.sql$//')"
test -n "$expected"
test "${latest//[[:space:]]/}" = "$expected"
printf "Migrations OK: %s\n" "$expected"

# Web
dc up -d --force-recreate --no-deps web
wait_healthy web 300
curl --fail --silent --show-error http://127.0.0.1:3010/prospector/api/health | grep -q '"ok":true'
printf 'Web healthy.\n'

# Workers (rebuild + restart de todos)
printf 'Subindo workers...\n'
dc up -d

# Nginx (configura proxy na primeira vez)
nginx_file=/etc/nginx/sites-available/design.rotadeataque.com.br
if ! grep -q 'prospector-platform' "$nginx_file"; then
  cp "$nginx_file" "$nginx_file.before-prospector-$run_id"
  python3 - "$nginx_file" <<'PY'
from pathlib import Path; import sys
p=Path(sys.argv[1]); text=p.read_text()
needle='  location / {\n'
block='  # prospector-platform\n  location ^~ /prospector {\n    proxy_pass http://127.0.0.1:3010;\n    proxy_http_version 1.1;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n  }\n\n'
if needle not in text: raise SystemExit('location raiz do nginx não encontrada')
p.write_text(text.replace(needle,block+needle,1))
PY
  nginx -t || { mv "$nginx_file.before-prospector-$run_id" "$nginx_file"; exit 1; }
  systemctl reload nginx
fi

# Validação final: Gazeta preservada
test "$(docker inspect -f '{{.Id}}' gazeta-n8n)" = "$gazeta_n8n_before"
test "$(docker inspect -f '{{.Id}}' gazeta-worker)" = "$gazeta_worker_before"
test "$(docker inspect -f '{{.State.Running}}' gazeta-n8n)" = true
test "$(docker inspect -f '{{.State.Running}}' gazeta-worker)" = true

# Ativar release e limpar antigas (mantém 3)
ln -sfn "$release" "$root/current"
find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r rm -rf
printf 'Prospector deploy concluído.\n'
'@
    $skipBuildFlag   = if ($SkipBuild)          { '1' } else { '0' }
    $reuseWorkerFlag = if ($ReuseWorkerImage)    { '1' } else { '0' }
    SshScript $prospectorScript @($RunId, $PlatformRemoteArchive, $skipBuildFlag, $reuseWorkerFlag, $ProspectorEnvFragment)

    Ssh 'test -L /opt/prospector-platform/current && curl --fail --silent --output /dev/null http://127.0.0.1:3010/prospector/api/health'
    Ok 'Prospector healthy: https://design.rotadeataque.com.br/prospector'

    if (Test-Path -LiteralPath $PlatformArchive) { Remove-Item -LiteralPath $PlatformArchive -Force -ErrorAction SilentlyContinue }
}

# ── Resumo ──────────────────────────────────────────────────────────────────

Step 'Deploy concluído'
if ($Only -in 'all', 'design') {
    Write-Host '  Design System: https://design.rotadeataque.com.br' -ForegroundColor Green
}
if ($Only -in 'all', 'prospector') {
    Write-Host '  Prospector:    https://design.rotadeataque.com.br/prospector' -ForegroundColor Green
}
Write-Host ''
