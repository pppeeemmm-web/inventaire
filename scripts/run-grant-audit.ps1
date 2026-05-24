# O1 — Supabase GRANT audit (deadline 2026-10-30). Read-only; writes no migrations.
# Requires SUPABASE_DB_URL in env or .env.local (postgresql://…).
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..' '.env.local')
)

$ErrorActionPreference = 'Stop'
$sqlPath = Join-Path $PSScriptRoot '..' 'supabase' 'sql' 'grant_audit_queries.sql'

if (-not (Test-Path $sqlPath)) {
  Write-Error "Missing $sqlPath"
}

if (-not $env:SUPABASE_DB_URL -and (Test-Path $EnvFile)) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$') {
      $env:SUPABASE_DB_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}

if (-not $env:SUPABASE_DB_URL) {
  Write-Error 'Set SUPABASE_DB_URL (postgresql connection string) before running the grant audit.'
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error 'psql not found. Install PostgreSQL client tools or run queries manually in Supabase SQL editor.'
}

Write-Host "[grant-audit] Running supabase/sql/grant_audit_queries.sql …"
& psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $sqlPath
Write-Host "[grant-audit] Done. Remediate any failures before 2026-10-30 (see docs/TODO.md O1)."
