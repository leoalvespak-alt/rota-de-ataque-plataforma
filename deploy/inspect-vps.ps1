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
echo '--- página direta 3010 ---'
curl -fsS http://127.0.0.1:3010/prospector/content-items | grep -oE 'Content items|Nada aqui ainda|Teses|Identidades' | sort -u || true
echo '--- página pública ---'
curl -kfsS -H 'Cache-Control: no-cache' "https://design.rotadeataque.com.br/prospector/content-items?inspect=$(date +%s)" | grep -oE 'Content items|Nada aqui ainda|Teses|Identidades' | sort -u || true
echo '--- rotas nginx prospector ---'
nginx -T 2>/dev/null | grep -B3 -A10 -n 'prospector' || true
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
& ssh @options $remote "printf '%s' '$encoded' | base64 --decode | bash"
if($LASTEXITCODE-ne 0){throw 'Inspeção remota falhou.'}
