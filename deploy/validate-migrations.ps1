param(
  [string]$IdentityFile = 'C:\Users\Lenovo\.ssh\id_rsa',
  [string]$CredentialsFile
)
$ErrorActionPreference = 'Stop'
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $PlatformRoot
if (-not $CredentialsFile) { $CredentialsFile = Join-Path $WorkspaceRoot 'CREDENCIAIS_VPS.txt' }
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw "Chave SSH não encontrada: $IdentityFile" }
if (-not (Test-Path -LiteralPath $CredentialsFile -PathType Leaf)) { throw "Credenciais não encontradas: $CredentialsFile" }

$credentials = @{}
Get-Content -LiteralPath $CredentialsFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$') { $credentials[$matches[1].Trim()] = $matches[2].Trim() }
}
$hostMatch = [regex]::Match($credentials['IPv4'], '\b(?:\d{1,3}\.){3}\d{1,3}\b')
$userEntry = $credentials.GetEnumerator() | Where-Object { $_.Key -match '^Nome do usu.*rio SSH$' } | Select-Object -First 1
if (-not $hostMatch.Success -or -not $userEntry) { throw 'Host/usuário SSH inválido.' }
$remote = "$(([string]$userEntry.Value -split '\s+')[0])@$($hostMatch.Value)"
$sshOptions = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$runId = (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$archive = Join-Path $env:TEMP "prospector-migrations-$runId.tar"
$remoteArchive = "/tmp/prospector-migrations-$runId.tar"

try {
  & tar -cf $archive -C $PlatformRoot packages/db/migrations
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao empacotar migrations.' }
  & scp @sshOptions $archive "${remote}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) { throw 'Falha no upload das migrations.' }
  $bash = @'
set -euo pipefail
run_id="$1"
archive="$2"
work="/tmp/prospector-migration-validation-$run_id"
empty_db="migration_empty_${run_id//[^a-zA-Z0-9]/_}"
upgrade_db="migration_upgrade_${run_id//[^a-zA-Z0-9]/_}"
pg_container="$(docker ps --filter name=prospector-platform-postgres --format '{{.ID}}' | head -n1)"
test -n "$pg_container"
mkdir -p "$work" /opt/prospector-platform/shared/backups
tar -xf "$archive" -C "$work"
rm -f "$archive"
cleanup() {
  docker exec "$pg_container" psql -U prospector -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$empty_db','$upgrade_db') AND pid<>pg_backend_pid();" >/dev/null 2>&1 || true
  docker exec "$pg_container" dropdb -U prospector --if-exists "$empty_db" >/dev/null 2>&1 || true
  docker exec "$pg_container" dropdb -U prospector --if-exists "$upgrade_db" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

backup="/opt/prospector-platform/shared/backups/pre-migration-validation-$run_id.dump"
docker exec "$pg_container" pg_dump -U prospector -d prospector -Fc > "$backup"
test -s "$backup"

docker exec "$pg_container" createdb -U prospector "$empty_db"
for file in "$work"/packages/db/migrations/*.up.sql; do
  docker exec -i "$pg_container" psql -U prospector -d "$empty_db" -v ON_ERROR_STOP=1 < "$file" >/dev/null
done
empty_tables="$(docker exec "$pg_container" psql -U prospector -d "$empty_db" -tAc "select count(*) from pg_tables where schemaname='public'")"
test "$empty_tables" -ge 110

docker exec "$pg_container" createdb -U prospector "$upgrade_db"
docker exec -i "$pg_container" pg_restore -U prospector -d "$upgrade_db" --no-owner --no-privileges < "$backup"
docker exec -i "$pg_container" psql -U prospector -d "$upgrade_db" -v ON_ERROR_STOP=1 < "$work/packages/db/migrations/0010_organic_intelligence.up.sql" >/dev/null
docker exec "$pg_container" psql -U prospector -d "$upgrade_db" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(version) VALUES('0010_organic_intelligence') ON CONFLICT DO NOTHING" >/dev/null
version="$(docker exec "$pg_container" psql -U prospector -d "$upgrade_db" -tAc 'select max(version) from schema_migrations')"
bridge="$(docker exec "$pg_container" psql -U prospector -d "$upgrade_db" -tAc "select to_regclass('public.creative_bridge_deliveries') is not null")"
test "$version" = '0010_organic_intelligence'
test "$bridge" = 't'
printf 'empty_tables=%s upgrade_version=%s restore=ok backup=%s\n' "$empty_tables" "$version" "$backup"
'@
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bash.Replace("`r`n", "`n")))
  & ssh.exe @sshOptions $remote "printf '%s' '$encoded' | base64 --decode | bash -s -- '$runId' '$remoteArchive'"
  if ($LASTEXITCODE -ne 0) { throw 'Validação remota das migrations falhou.' }
} finally {
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
}
