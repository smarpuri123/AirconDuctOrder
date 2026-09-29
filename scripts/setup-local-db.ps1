# ECOVENT Operations - local PostgreSQL setup (no Docker)
# Matches native Postgres install pattern from pvsresponse/LOCAL_DEV.md
#
# Usage:
#   $env:PGPASSWORD="novaerp"; npm run db:setup -- -SkipInstall

param(
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = $env:PGPASSWORD,
  [string]$PostgresHost = "localhost",
  [int]$PostgresPort = 0,
  [switch]$SkipInstall,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SqlFile = Join-Path $Root "scripts\init-db.sql"

function Find-Psql {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $versions = 18, 17, 16, 15, 14, 13, 12
  foreach ($v in $versions) {
    $candidate = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Get-PostgresPort {
  $versions = 18, 17, 16, 15, 14
  foreach ($v in $versions) {
    $conf = "C:\Program Files\PostgreSQL\$v\data\postgresql.conf"
    if (Test-Path $conf) {
      $match = Select-String -Path $conf -Pattern '^\s*port\s*=\s*(\d+)' | Select-Object -First 1
      if ($match) { return [int]$match.Matches[0].Groups[1].Value }
    }
  }
  return 5432
}

function Install-PostgreSQL {
  Write-Host ""
  Write-Host "PostgreSQL not found. Installing via winget..." -ForegroundColor Yellow
  Write-Host "See pvsresponse/LOCAL_DEV.md for install options." -ForegroundColor Yellow
  Write-Host ""

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "winget not found. Install PostgreSQL from https://www.postgresql.org/download/windows/"
  }

  winget install --id PostgreSQL.PostgreSQL -e --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL installation failed."
  }

  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "ECOVENT - Local database setup (no Docker)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$psql = Find-Psql
if (-not $psql -and -not $SkipInstall) {
  Install-PostgreSQL
  $psql = Find-Psql
}

if (-not $psql) {
  throw "psql not found. Add PostgreSQL bin to PATH, then run db:setup with -SkipInstall"
}

if ($PostgresPort -le 0) {
  $PostgresPort = Get-PostgresPort
}

Write-Host ("Using psql: " + $psql) -ForegroundColor Gray
Write-Host ("Port: " + $PostgresPort) -ForegroundColor Gray

if (-not $PostgresPassword) {
  $secure = Read-Host "Enter postgres superuser password" -AsSecureString
  $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "Creating ecovent user..." -ForegroundColor Green
& $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -f $SqlFile
if ($LASTEXITCODE -ne 0) {
  throw "Database bootstrap failed. Check postgres password and service status."
}

$dbExists = & $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'ecovent_ops'"
if ($dbExists -ne "1") {
  Write-Host "Creating ecovent_ops database..." -ForegroundColor Green
  & $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -c "CREATE DATABASE ecovent_ops OWNER ecovent"
  if ($LASTEXITCODE -ne 0) { throw "Failed to create database ecovent_ops" }
} else {
  Write-Host "Database ecovent_ops already exists." -ForegroundColor Gray
}

Write-Host "Granting schema permissions..." -ForegroundColor Green
$grantSql = 'GRANT ALL ON SCHEMA public TO ecovent; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ecovent; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ecovent;'
& $psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d ecovent_ops -c $grantSql
if ($LASTEXITCODE -ne 0) { throw "Failed to grant schema permissions" }

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

$serverEnv = Join-Path $Root "server\.env"
$serverEnvExample = Join-Path $Root "server\.env.example"
$dbUrl = 'postgresql://ecovent:ecovent_dev@localhost:' + $PostgresPort + '/ecovent_ops?schema=public'

if (-not (Test-Path $serverEnv) -and (Test-Path $serverEnvExample)) {
  Copy-Item $serverEnvExample $serverEnv
}
if (Test-Path $serverEnv) {
  $content = Get-Content $serverEnv -Raw
  if ($content -match 'DATABASE_URL=') {
    $content = [regex]::Replace($content, 'DATABASE_URL=.*', ('DATABASE_URL=' + $dbUrl))
  } else {
    $content = ('DATABASE_URL=' + $dbUrl + "`n" + $content)
  }
  Set-Content -Path $serverEnv -Value $content.TrimEnd() -NoNewline
  Add-Content -Path $serverEnv -Value ""
}

Write-Host "Applying Prisma schema..." -ForegroundColor Green
Push-Location (Join-Path $Root "server")
try {
  npm run db:generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }

  npm run db:push
  if ($LASTEXITCODE -ne 0) { throw "prisma db push failed" }

  if (-not $SkipSeed) {
    Write-Host "Seeding auth + optional demo business data..." -ForegroundColor Green
    $env:SEED_DEMO_DATA = "true"
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { throw "db seed failed" }
    Remove-Item Env:SEED_DEMO_DATA -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Local database ready!" -ForegroundColor Green
Write-Host ""
Write-Host ("Connection: " + $dbUrl)
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Set VITE_USE_API=true in .env (project root)"
Write-Host "  2. npm run dev:all"
Write-Host "  3. Open http://localhost:5173/login"
Write-Host '     admin@ecovent.com / Admin@123'
Write-Host ""
