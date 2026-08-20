param([string]$IdentityFile='C:\Users\Lenovo\.ssh\id_rsa',[string]$CredentialsFile)
$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot;$workspaceRoot=Split-Path -Parent $platformRoot
if(-not $CredentialsFile){$CredentialsFile=Join-Path $workspaceRoot 'CREDENCIAIS_VPS.txt'}
$credentials=@{};Get-Content -LiteralPath $CredentialsFile -Encoding UTF8|ForEach-Object{if($_ -match '^\s*([^#=:\r\n]+?)\s*[:=]\s*(.*?)\s*$'){$credentials[$matches[1].Trim()]=$matches[2].Trim()}}
$hostMatch=[regex]::Match($credentials['IPv4'],'\b(?:\d{1,3}\.){3}\d{1,3}\b');$userEntry=$credentials.GetEnumerator()|Where-Object{$_.Key -match '^Nome do usu.*rio SSH$'}|Select-Object -First 1
if(-not $hostMatch.Success -or -not $userEntry){throw 'Host/usuário SSH inválido.'}
$remote="$(([string]$userEntry.Value -split '\s+')[0])@$($hostMatch.Value)";$options=@('-i',$IdentityFile,'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','ConnectTimeout=20')
& ssh.exe @options $remote "set -e; echo before; df -h /var/lib/docker | tail -n 1; docker builder prune --all --force; echo after; df -h /var/lib/docker | tail -n 1; docker inspect -f '{{.State.Running}}' gazeta-n8n | grep -q true; docker inspect -f '{{.State.Running}}' gazeta-worker | grep -q true"
if($LASTEXITCODE -ne 0){throw 'Limpeza de cache remoto falhou.'}
