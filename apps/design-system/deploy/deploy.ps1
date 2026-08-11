<#
Deploy seguro do Gerador de Criativos (Gerador-React) para o VPS compartilhado.

O script nunca altera Git. Ele valida localmente, publica um pacote em diretório
temporário irmão do site, valida o nginx e faz a troca com rollback automático.

Uso:
  .\deploy\deploy.ps1
  .\deploy\deploy.ps1 -NoPush                 # compatível; Git nunca é alterado
  .\deploy\deploy.ps1 -SkipBuild               # publica o dist/ já validado
  .\deploy\deploy.ps1 -IdentityFile C:\caminho\para\chave
#>

param(
    [switch]$NoPush,
    [switch]$SkipBuild,
    [switch]$DesignOnly,
    [string]$IdentityFile = 'C:\Users\Lenovo\.ssh\id_rsa'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $PSScriptRoot '.env'
$DistDir = Join-Path $RepoRoot 'dist'
$ExpectedTargetDir = '/var/www/design-rota-ataque'
$RunId = [guid]::NewGuid().ToString('N')
$ArchiveName = "gerador-react-dist-$RunId.tar.gz"
$LocalArchive = Join-Path $env:TEMP $ArchiveName
$Uploaded = $false
$RemoteArchive = $null
$SshOptions = @(
    '-i', $IdentityFile,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15'
)

function Write-Step([string]$Message) {
    Write-Host "\`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw $Message
}

function Invoke-RemoteScript([string]$Script, [string[]]$Arguments = @()) {
    $quotedArguments = ($Arguments | ForEach-Object { "'$_'" }) -join ' '
    # A pipeline do Windows PowerShell pode antepor um BOM ao stdin do processo
    # nativo. Codificar explicitamente impede que o Bash interprete o marcador
    # BOM como parte do primeiro comando, preservando o fail-fast remoto.
    $encodedScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    & ssh @SshOptions $Remote "printf '%s' '$encodedScript' | base64 --decode | bash -s -- $quotedArguments"
    if ($LASTEXITCODE -ne 0) {
        Fail 'Comando remoto falhou.'
    }
}

function Remove-RemoteArchive {
    if (-not $Uploaded -or -not $RemoteArchive) { return }

    & ssh @SshOptions $Remote "rm -f '$RemoteArchive'"
    if ($LASTEXITCODE -eq 0) {
        $script:Uploaded = $false
    } else {
        Write-Warning 'Não foi possível remover o arquivo temporário remoto. Ele tem nome exclusivo desta execução.'
    }
}

try {
    if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
        Fail "Chave SSH não encontrada: $IdentityFile"
    }

    if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
        Fail 'deploy/.env não encontrado. Copie deploy/.env.example e preencha somente os parâmetros do VPS.'
    }

    $EnvVars = @{}
    Get-Content -LiteralPath $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line.Split('=', 2)
            $EnvVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }

    foreach ($key in @('VPS_HOST', 'VPS_USER', 'VPS_TARGET_DIR', 'VPS_DOMAIN')) {
        if (-not $EnvVars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($EnvVars[$key])) {
            Fail "Variável '$key' ausente ou vazia em deploy/.env"
        }
    }

    $VpsHost = $EnvVars['VPS_HOST']
    $VpsUser = $EnvVars['VPS_USER']
    $TargetDir = $EnvVars['VPS_TARGET_DIR']
    $Domain = $EnvVars['VPS_DOMAIN']

    if ($VpsHost -notmatch '^[a-zA-Z0-9.-]+$' -or $VpsUser -notmatch '^[a-zA-Z0-9_-]+$') {
        Fail 'VPS_HOST ou VPS_USER contém caracteres não permitidos.'
    }
    if ($TargetDir -ne $ExpectedTargetDir) {
        Fail "VPS_TARGET_DIR deve ser exatamente '$ExpectedTargetDir' para este script."
    }
    if ($Domain -notmatch '^[a-zA-Z0-9.-]+$') {
        Fail 'VPS_DOMAIN contém caracteres não permitidos.'
    }

    $Remote = "$VpsUser@$VpsHost"
    $RemoteArchive = "/tmp/$ArchiveName"
    Set-Location $RepoRoot

    Write-Step 'Preflight SSH e confirmação do diretório de publicação'
    $preflightScript = @'
set -euo pipefail
target="$1"
expected="/var/www/design-rota-ataque"
test "$target" = "$expected"
test -d "$target"
test -f "$target/index.html"
printf 'Preflight remoto concluído para o Sistema de Design.\n'
'@
    Invoke-RemoteScript $preflightScript @($TargetDir)

    if (-not $SkipBuild) {
        Write-Step 'Lint (eslint .)'
        & npm run lint
        if ($LASTEXITCODE -ne 0) { Fail 'Lint falhou. Corrija os erros antes de publicar.' }

        Write-Step 'Build de produção (tsc -b && vite build)'
        & npm run build
        if ($LASTEXITCODE -ne 0) { Fail 'Build falhou. Corrija os erros antes de publicar.' }
    } else {
        Write-Step 'SkipBuild ativo — reutilizando dist/ existente'
    }

    if (-not (Test-Path -LiteralPath (Join-Path $DistDir 'index.html') -PathType Leaf)) {
        Fail 'dist/index.html não existe. Não há artefato válido para publicar.'
    }

    Write-Step 'Git permanece inalterado'
    if ($NoPush) {
        Write-Host 'NoPush ativo — o script não executa add, commit ou push.' -ForegroundColor Yellow
    } else {
        Write-Host 'O deploy seguro não executa add, commit ou push.' -ForegroundColor Yellow
    }

    Write-Step 'Empacotando dist/ para envio'
    & tar -czf $LocalArchive -C $DistDir .
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao empacotar dist/ (tar).' }

    Write-Step 'Enviando pacote ao VPS por chave SSH explícita'
    & scp @SshOptions $LocalArchive "${Remote}:$RemoteArchive"
    if ($LASTEXITCODE -ne 0) { Fail 'scp falhou. O site em produção não foi alterado.' }
    $Uploaded = $true

    Write-Step 'Validando e publicando com rollback automático'
    $publishScript = @'
set -euo pipefail
target="$1"
archive="$2"
stage="${target}.staging-$$"
backup="${target}.previous-$$"

cleanup() {
  rm -rf "$stage"
  rm -f "$archive"
}

rollback() {
  status=$?
  if [ -d "$backup" ]; then
    rm -rf "$target"
    mv "$backup" "$target"
    nginx -t && systemctl reload nginx || true
  fi
  cleanup
  exit "$status"
}

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
nginx -t
systemctl reload nginx
rm -rf "$backup"
cleanup
trap - ERR
printf 'Publicação remota concluída.\n'
'@
    Invoke-RemoteScript $publishScript @($TargetDir, $RemoteArchive)
    $Uploaded = $false

    Write-Step 'Deploy concluído'
    Write-Host "Site: https://$Domain" -ForegroundColor Green

    if (-not $DesignOnly) {
        Write-Step 'Deploy da plataforma para Rota de Ataque e Gazeta Concursos'
        $PlatformDeploy = Join-Path (Split-Path -Parent (Split-Path -Parent $RepoRoot)) 'deploy\deploy.ps1'
        & $PlatformDeploy -IdentityFile $IdentityFile
        if ($LASTEXITCODE -ne 0) { Fail 'Deploy da plataforma falhou após a publicação do Design System.' }
    }
}
catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Remove-RemoteArchive
    if (Test-Path -LiteralPath $LocalArchive) {
        Remove-Item -LiteralPath $LocalArchive -Force -ErrorAction SilentlyContinue
    }
}
