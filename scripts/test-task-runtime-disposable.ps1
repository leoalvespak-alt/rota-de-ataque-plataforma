$ErrorActionPreference = 'Stop'

$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$databaseName = "codex_task_runtime_test_$suffix"
$roleName = "codex_task_runtime_$suffix"
$passwordBytes = [byte[]]::new(32)
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($passwordBytes)
$random.Dispose()
$password = [BitConverter]::ToString($passwordBytes).Replace('-', '')

rtk wsl -e bash -lc 'pg_isready -h 127.0.0.1 -p 5432'
if ($LASTEXITCODE -ne 0) { throw 'WSL2 PostgreSQL on port 5432 is unavailable.' }
$wslAddress = ((rtk wsl -e hostname -I).Trim() -split '\s+')[0]
if (-not $wslAddress) { throw 'Could not resolve the WSL2 PostgreSQL address.' }

$preflightSql = "SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_database WHERE datname='$databaseName') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='$roleName') THEN 'collision' ELSE 'free' END"
$preflight = rtk wsl -e sudo -n -u postgres psql -d postgres -Atqc $preflightSql
if ($LASTEXITCODE -ne 0 -or $preflight.Trim() -ne 'free') { throw 'The randomly named disposable test database or role already exists; nothing was removed.' }

$roleCreated = $false
$databaseCreated = $false
try {
  $roleSql = @"
DO `$`$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$roleName') THEN
    RAISE EXCEPTION 'Disposable test role name already exists';
  END IF;
END `$`$;
CREATE ROLE $roleName LOGIN PASSWORD '$password';
"@
  $roleSql | rtk wsl -e bash -lc 'sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d postgres -f -'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable WSL2 test role.' }
  $roleCreated = $true

  $databaseSql = @"
DO `$`$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname='$databaseName') THEN
    RAISE EXCEPTION 'Disposable test database name already exists';
  END IF;
END `$`$;
CREATE DATABASE $databaseName OWNER $roleName;
"@
  $databaseSql | rtk wsl -e bash -lc 'sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d postgres -f -'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable WSL2 test database.' }
  $databaseCreated = $true

  rtk wsl -e env "PGPASSWORD=$password" psql -w -h 127.0.0.1 -p 5432 -U $roleName -d $databaseName -Atqc 'SELECT 1'
  if ($LASTEXITCODE -ne 0) { throw 'The disposable WSL2 test database credentials did not authenticate.' }

  $env:TASK_RUNTIME_TEST_DATABASE_URL = "postgresql://${roleName}:${password}@${wslAddress}:5432/${databaseName}"
  rtk pnpm --dir workers/editorial-executor test
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL task-runtime integration tests failed.' }

  rtk pnpm --dir packages/db exec vitest run src/migrations.test.ts
  if ($LASTEXITCODE -ne 0) { throw 'Database migration contract tests failed.' }
}
finally {
  Remove-Item Env:TASK_RUNTIME_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  $cleanupSql = ''
  if ($databaseCreated) { $cleanupSql += "DROP DATABASE IF EXISTS $databaseName WITH (FORCE);`n" }
  if ($roleCreated) { $cleanupSql += "DROP ROLE IF EXISTS $roleName;`n" }
  if ($cleanupSql) {
    $cleanupSql | rtk wsl -e bash -lc 'sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d postgres -f -' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cleanup could not remove the disposable test objects.' }
  }
  $cleanupCheckSql = "SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pg_database WHERE datname='$databaseName') AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='$roleName') THEN 'clean' ELSE 'leaked' END"
  $cleanupState = rtk wsl -e sudo -n -u postgres psql -d postgres -Atqc $cleanupCheckSql
  if ($LASTEXITCODE -ne 0 -or $cleanupState.Trim() -ne 'clean') { throw 'Disposable test database or role remains after cleanup.' }
}
