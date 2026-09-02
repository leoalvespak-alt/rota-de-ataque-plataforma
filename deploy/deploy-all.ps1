<#
.SYNOPSIS
  Unified deploy script for all Rota de Ataque projects.
.DESCRIPTION
  Commits, pushes, waits for CI, and deploys to VPS via the canonical release script over SSH.
.PARAMETER Only
  Deploy a specific project: design, design-api, gazeta, plataforma
.PARAMETER SkipPush
  Skip git add/commit/push (deploy existing images)
.PARAMETER Message
  Custom commit message (default: auto-generated)
.PARAMETER Migrate
  Run database migrations after deploy (default: true)
.EXAMPLE
  .\deploy\deploy-all.ps1 -Only design
  .\deploy\deploy-all.ps1 -Only plataforma -SkipPush
  .\deploy\deploy-all.ps1  # deploys all
#>
param(
  [ValidateSet('design','design-api','gazeta','plataforma','all')]
  [string]$Only = 'all',
  [switch]$SkipPush,
  [string]$Message = '',
  [switch]$NoMigrate
)

$ErrorActionPreference = 'Stop'
$VPS = 'root@187.127.249.22'
$DeployScript = '/opt/rota-deploy/deploy.sh'

function Log($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] WARN: $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] FAIL: $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $msg" -ForegroundColor Green }

function Get-RepoRoot {
  $g = git rev-parse --show-toplevel 2>$null
  if (-not $g) { Fail "Not in a git repository" }
  return $g
}

function Invoke-GitPush {
  param([string]$RepoPath, [string]$CommitMsg)
  Push-Location $RepoPath
  try {
    $status = git status --porcelain 2>&1
    if ($status) {
      Log "Staging changes..."
      git add -A
      if (-not $CommitMsg) {
        $CommitMsg = "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
      }
      git commit -m $CommitMsg
    } else {
      Log "No changes to commit"
    }
    Log "Pushing to origin..."
    git push origin HEAD 2>&1
    $branch = git rev-parse --abbrev-ref HEAD
    Ok "Pushed to $branch"
    return $branch
  } finally {
    Pop-Location
  }
}

function Wait-CI {
  param([string]$Repo, [string]$Branch, [int]$TimeoutMin = 15)
  Log "Waiting for CI on $Repo ($Branch)..."
  $deadline = (Get-Date).AddMinutes($TimeoutMin)
  $runId = $null

  for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 10
    $runs = gh run list --repo $Repo --branch $Branch --limit 1 --json databaseId,status,conclusion 2>$null | ConvertFrom-Json
    if ($runs -and $runs.Count -gt 0) {
      $runId = $runs[0].databaseId
      break
    }
  }

  if (-not $runId) { Warn "No CI run found, proceeding anyway"; return }
  Log "CI run #$runId found"

  while ((Get-Date) -lt $deadline) {
    $run = gh run view $runId --repo $Repo --json status,conclusion 2>$null | ConvertFrom-Json
    if ($run.status -eq 'completed') {
      if ($run.conclusion -eq 'success') {
        Ok "CI passed"
        return
      } else {
        Fail "CI failed (conclusion: $($run.conclusion)). Fix and retry."
      }
    }
    Log "CI still running... waiting 30s"
    Start-Sleep -Seconds 30
  }
  Fail "CI timed out after ${TimeoutMin}min"
}

function Invoke-VPSDeploy {
  param([string]$Project, [switch]$Migrate)
  $migrateFlag = if ($Migrate) { '--migrate' } else { '' }
  Log "Deploying $Project on VPS..."
  ssh $VPS "$DeployScript $Project $migrateFlag" 2>&1 | ForEach-Object { Write-Host "  VPS: $_" }
  if ($LASTEXITCODE -ne 0) { Fail "VPS deploy failed for $Project" }
  Ok "$Project deployed successfully"
}

# --- Project paths ---
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$plataformaRepo = Join-Path $workspace 'plataforma'
$plataforma2Repo = Join-Path $workspace 'Plataforma 2-0 - Next - rota de Ataque'
$gazetaRepo = Join-Path $workspace 'gazetacon'

$doMigrate = -not $NoMigrate

# --- Main ---
Log "Deploy target: $Only"

switch ($Only) {
  'design' {
    if (-not $SkipPush) {
      Invoke-GitPush -RepoPath $plataformaRepo -CommitMsg $Message
      Wait-CI -Repo 'leoalvespak-alt/rota-de-ataque-plataforma' -Branch 'main'
    }
    Invoke-VPSDeploy -Project 'design-web'
    Invoke-VPSDeploy -Project 'design-api' -Migrate:$doMigrate
  }
  'design-api' {
    if (-not $SkipPush) {
      Invoke-GitPush -RepoPath $plataformaRepo -CommitMsg $Message
      Wait-CI -Repo 'leoalvespak-alt/rota-de-ataque-plataforma' -Branch 'main'
    }
    Invoke-VPSDeploy -Project 'design-api' -Migrate:$doMigrate
  }
  'gazeta' {
    if (-not $SkipPush) {
      if (Test-Path $gazetaRepo) {
        Invoke-GitPush -RepoPath $gazetaRepo -CommitMsg $Message
      } else {
        Warn "Gazeta repo not found at $gazetaRepo, triggering deploy only"
      }
    }
    Invoke-VPSDeploy -Project 'gazeta'
  }
  'plataforma' {
    if (-not $SkipPush) {
      Invoke-GitPush -RepoPath $plataforma2Repo -CommitMsg $Message
      Wait-CI -Repo 'leoalvespak-alt/rota-de-ataque-v2' -Branch 'main'
    }
    Invoke-VPSDeploy -Project 'plataforma'
  }
  'all' {
    Log "=== Full deploy of all projects ==="
    if (-not $SkipPush) {
      Invoke-GitPush -RepoPath $plataformaRepo -CommitMsg $Message
      Wait-CI -Repo 'leoalvespak-alt/rota-de-ataque-plataforma' -Branch 'main'
    }
    Invoke-VPSDeploy -Project 'design-web'
    Invoke-VPSDeploy -Project 'design-api' -Migrate:$doMigrate
    Invoke-VPSDeploy -Project 'gazeta'
    if (-not $SkipPush -and (Test-Path $plataforma2Repo)) {
      Invoke-GitPush -RepoPath $plataforma2Repo -CommitMsg $Message
      Wait-CI -Repo 'leoalvespak-alt/rota-de-ataque-v2' -Branch 'main'
    }
    Invoke-VPSDeploy -Project 'plataforma'
    Ok "=== All projects deployed ==="
  }
}

# Final status
Log "Running VPS health check..."
ssh $VPS "$DeployScript status" 2>&1 | ForEach-Object { Write-Host "  VPS: $_" }
Ok "Deploy complete"
