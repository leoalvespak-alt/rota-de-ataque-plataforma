param([string]$IdentityFile='C:\Users\Lenovo\.ssh\id_rsa',[string]$CredentialsFile)
$ErrorActionPreference='Stop'
$PlatformRoot=Split-Path -Parent $PSScriptRoot
$WorkspaceRoot=Split-Path -Parent $PlatformRoot
if(-not $CredentialsFile){$CredentialsFile=Join-Path $WorkspaceRoot 'CREDENCIAIS_VPS.txt'}
$credentials=@{}
Get-Content -LiteralPath $CredentialsFile -Encoding UTF8|ForEach-Object{if($_ -match '^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$'){$credentials[$matches[1].Trim()]=$matches[2].Trim()}}
$hostMatch=[regex]::Match($credentials['IPv4'],'\b(?:\d{1,3}\.){3}\d{1,3}\b')
$userEntry=$credentials.GetEnumerator()|Where-Object{$_.Key -match '^Nome do usu.*rio SSH$'}|Select-Object -First 1
$remote="$(([string]$userEntry.Value -split '\s+')[0])@$($hostMatch.Value)"
$options=@('-i',$IdentityFile,'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','ConnectTimeout=20')
$script=@'
set -euo pipefail
echo '--- container prospector ---'
docker ps --filter name=prospector-platform-web --format '{{.ID}} {{.Image}} {{.Ports}} {{.Status}}'
echo '--- imagem do container ---'
cid="$(docker ps -q --filter name=prospector-platform-web)"
docker inspect -f 'container_image={{.Image}}' "$cid"
docker image inspect -f 'latest_image={{.Id}}' prospector-platform-web:latest
echo '--- erros recentes do web ---'
docker logs --since 20m "$cid" 2>&1 | tail -n 200 || true
echo '--- health direto ---'
curl -sS -i http://127.0.0.1:3010/prospector/api/health | tail -n 20 || true
echo '--- healthcheck docker ---'
docker inspect -f '{{range .State.Health.Log}}{{.ExitCode}} {{.Output}}{{end}}' "$cid" | tail -n 20 || true
echo '--- página direta 3010 ---'
curl -fsS http://127.0.0.1:3010/prospector/content-items | grep -oE 'Content items|Nada aqui ainda|Teses|Identidades' | sort -u || true
echo '--- página pública ---'
curl -kfsS -H 'Cache-Control: no-cache' "https://design.rotadeataque.com.br/prospector/content-items?inspect=$(date +%s)" | grep -oE 'Content items|Nada aqui ainda|Teses|Identidades' | sort -u || true
echo '--- rotas nginx prospector ---'
nginx -T 2>/dev/null | grep -B3 -A10 -n 'prospector' || true
echo '--- serviços prospector ---'
docker ps --filter label=com.docker.compose.project=prospector-platform --format '{{.Names}}|{{.Image}}|{{.Status}}' | sort
echo '--- resumo de workers ---'
worker_count="$(docker ps --filter label=com.docker.compose.project=prospector-platform --format '{{.Names}}' | grep -c '^prospector-platform-worker-' || true)"
worker_image_count="$(docker ps --filter label=com.docker.compose.project=prospector-platform --format '{{.Image}}' | grep '^prospector-platform-worker:' | sort -u | wc -l)"
printf 'workers_running=%s unique_worker_images=%s\n' "$worker_count" "$worker_image_count"
echo '--- scheduler ---'
docker ps --filter name=prospector-platform-scheduler --format '{{.Names}}|{{.Image}}|{{.Status}}'
scheduler_cid="$(docker ps -q --filter label=com.docker.compose.project=prospector-platform --filter label=com.docker.compose.service=scheduler)"
test -z "$scheduler_cid" || docker logs --since 20m "$scheduler_cid" 2>&1 | tail -n 40 || true
echo '--- gate de worker (amostra) ---'
sample_worker_cid="$(docker ps -q --filter label=com.docker.compose.project=prospector-platform --filter label=com.docker.compose.service=worker-discovery)"
test -z "$sample_worker_cid" || docker logs --since 20m "$sample_worker_cid" 2>&1 | tail -n 20 || true
echo '--- migrations prospector ---'
postgres_cid="$(docker ps -q --filter label=com.docker.compose.project=prospector-platform --filter label=com.docker.compose.service=postgres)"
test -z "$postgres_cid" || docker exec "$postgres_cid" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select version from schema_migrations order by version desc limit 3"' || true
test -z "$postgres_cid" || docker exec "$postgres_cid" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from information_schema.tables where table_schema = '\''public'\''"' || true
echo '--- baseline editorial manual por campanha ---'
test -z "$postgres_cid" || docker exec "$postgres_cid" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -AtF "|" -c "select c.name, count(distinct t.id) filter (where t.locked_by = '\''growth-organic-baseline-v1'\''), count(distinct p.id) filter (where p.locked_by = '\''growth-organic-baseline-v1'\''), count(distinct s.id) filter (where s.evidence->>'\''seed'\'' = '\''growth-organic-baseline-v1'\'') from campaigns c left join theses t on t.campaign_id = c.id left join scheduled_publications p on p.campaign_id = c.id left join content_suggestions s on s.campaign_id = c.id group by c.id, c.name order by c.name"' || true
echo '--- contrato HTTP de notificacoes sem sessao ---'
printf 'notifications_count_http='; curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/prospector/api/admin/notifications/count || true
echo
echo '--- design system ---'
docker ps -a --filter label=com.docker.compose.project=rota-design-api --format '{{.Names}}|{{.Image}}|{{.Status}}' | sort
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -Ei 'design|editorial-api' | sort || true
docker ps --format '{{.Names}}|{{.Ports}}' | grep -E '3001|3002' | sort || true
docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedSince}}' 'rota-design-api' | head -n 5 || true
docker events --since 2h --until "$(date -Iseconds)" --filter label=com.docker.compose.project=rota-design-api --filter label=com.docker.compose.service=api --format '{{.Time}}|{{.Action}}|{{.Actor.Attributes.name}}|{{.Actor.Attributes.image}}' | tail -n 30 || true
if [ -d /opt/rota-design-api/current ]; then
  cd /opt/rota-design-api/current
  docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml ps -a || true
fi
nginx -T 2>/dev/null | grep -B2 -A12 -n 'rota-design-api' || true
nginx -T 2>/dev/null | grep -B2 -A10 -n 'location.*api' || true
curl -fsS http://127.0.0.1:3002/health || true
echo
curl -kfsS https://design.rotadeataque.com.br/api/health || true
echo
printf 'ready_http='; curl -ksS -o /dev/null -w '%{http_code}' https://design.rotadeataque.com.br/api/ready || true
echo
printf 'protected_ai_http='; curl -ksS -o /dev/null -w '%{http_code}' https://design.rotadeataque.com.br/api/ai/catalog || true
echo
design_pg_cid="$(docker ps -q --filter label=com.docker.compose.project=rota-design-api --filter label=com.docker.compose.service=postgres)"
test -z "$design_pg_cid" || docker exec "$design_pg_cid" psql -U rota_design -d rota_design -Atc 'select version from design_schema_migrations order by applied_at' || true
echo '--- comparação de bancos design ---'
for design_db_name in rota-design-api-postgres-1 design-postgres; do
  design_db_cid="$(docker ps -q --filter name=^/${design_db_name}$)"
  test -z "$design_db_cid" && continue
  printf '%s|' "$design_db_name"
  docker exec "$design_db_cid" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from information_schema.tables where table_schema = '\''public'\''"' || true
  docker exec "$design_db_cid" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select table_name from information_schema.tables where table_schema = '\''public'\'' order by table_name"' | head -n 80 || true
  docker exec "$design_db_cid" sh -lc 'for t in $(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select quote_ident(table_name) from information_schema.tables where table_schema = '\''public'\'' order by table_name"); do c=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from $t"); test "$c" = 0 || printf "%s=%s\n" "$t" "$c"; done' || true
done
echo
echo '--- gazeta preservada ---'
docker ps --filter name=gazeta --format '{{.Names}}|{{.Image}}|{{.Status}}'
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
$remoteScript="/tmp/rota-inspect-$([guid]::NewGuid().ToString('N')).sh"
& ssh @options $remote "printf '%s' '$encoded' | base64 --decode > '$remoteScript'; bash '$remoteScript'; rc=`$?; rm -f '$remoteScript'; exit `$rc"
if($LASTEXITCODE-ne 0){throw 'Inspeção remota falhou.'}
