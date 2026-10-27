param(
  [string]$DumpFile = "remote_backup.sql",
  [string]$Host = "localhost",
  [int]$Port = 5433,
  [string]$User = "ecovent",
  [string]$Database = "ecovent_ops",
  [string]$Password = "ecovent_dev"
)

$ErrorActionPreference = "Stop"

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

$psql = Find-Psql
if (-not $psql) {
  throw "psql.exe not found. Please install PostgreSQL or add psql to PATH."
}

if (-not (Test-Path $DumpFile)) {
  throw "Dump file '$DumpFile' not found. Please place remote_backup.sql in this directory."
}

Write-Host "Restoring database from $DumpFile into $Database on $Host`:$Port..." -ForegroundColor Cyan

$env:PGPASSWORD = $Password
try {
  & $psql -h $Host -p $Port -U $User -d $Database -f $DumpFile
  Write-Host "Database restore completed successfully!" -ForegroundColor Green
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (Test-Path "enquiry_uploads.tar.gz") {
  Write-Host "Restoring enquiry uploaded files..." -ForegroundColor Cyan
  $uploadsTarget = "server/uploads"
  if (-not (Test-Path $uploadsTarget)) {
    New-Item -ItemType Directory -Path $uploadsTarget -Force | Out-Null
  }
  tar -xzf enquiry_uploads.tar.gz -C $uploadsTarget
  Write-Host "Enquiry uploads extracted to $uploadsTarget." -ForegroundColor Green
}
