$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$credentialsFile = Join-Path $workspace '..\CREDENCIAIS_VPS.txt'
$envFile = Join-Path $PSScriptRoot '.env.production'
$hostValue = $null
$userValue = $null
if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object { if ($_ -match '^\s*(VPS_HOST|VPS_USER)\s*=\s*(.+?)\s*$') { if ($Matches[1] -eq 'VPS_HOST') { $hostValue=$Matches[2] }; if ($Matches[1] -eq 'VPS_USER') { $userValue=$Matches[2] } } }
}
if (-not $hostValue -or -not $userValue) {
  $lines = Get-Content -LiteralPath $credentialsFile
  $hostValue = ([regex]::Match(($lines -join "`n"), '\b(?:\d{1,3}\.){3}\d{1,3}\b')).Value
  $userValue = (($lines | Where-Object { $_ -match '^Nome do usu.*rio SSH\s*:' } | Select-Object -First 1) -split ':',2)[1].Trim()
}
$key = 'C:\Users\Lenovo\.ssh\id_rsa'
$remote = "$userValue@$hostValue"
$opts = @('-i',$key,'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','ConnectTimeout=20')
$ErrorActionPreference = 'Stop'
Write-Output 'Connected deployment target; collecting Docker diagnostic.'
$diagnostic = 'ps -eo pid=,ppid=,etime=,args= | grep -E "docker( compose)? .*build|buildkit" | grep -v grep || true'
& ssh.exe @opts $remote $diagnostic
$status = 'free -m; docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "prospector|NAMES" || true'
& ssh.exe @opts $remote $status
$verify = 'curl --fail --silent http://127.0.0.1:3010/prospector/api/health; echo; docker exec prospector-platform-postgres-1 psql -U prospector -d prospector -Atc "select version from schema_migrations order by version desc limit 1"; docker logs --tail 30 prospector-platform-worker-conversation-agent-1 2>&1; docker logs --tail 30 prospector-platform-worker-private-reply-1 2>&1'
& ssh.exe @opts $remote $verify
& ssh.exe @opts $remote 'curl --silent http://127.0.0.1:8080/info'
$cleanup = 'pids=$(ps -eo pid=,args= | awk ''/docker( compose)? .*build/ && /prospector-platform/ {print $1}''); if [ -n "$pids" ]; then kill $pids; sleep 3; fi; docker builder prune -f >/dev/null; echo "prospector build recovery complete"'
& ssh.exe @opts $remote $cleanup
