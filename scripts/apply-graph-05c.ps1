# Apply graph foundation 05c — fixes WorkDrawer theme save ON CONFLICT error.
# Requires SUPABASE_DB_URL in env or .env.local (postgresql://…).
param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..' '.env.local')
)

$ErrorActionPreference = 'Stop'
$sqlPath = Join-Path $PSScriptRoot '..' 'supabase' 'sql' 'graph_foundation' '05c_graph_sync_safe_insert.sql'

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
  Write-Error 'Set SUPABASE_DB_URL (postgresql connection string) or add it to .env.local.'
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error 'psql not found. Paste supabase/sql/graph_foundation/05c_graph_sync_safe_insert.sql into Supabase SQL editor and run.'
}

Write-Host "[graph-05c] Applying 05c_graph_sync_safe_insert.sql …"
& psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $sqlPath
Write-Host "[graph-05c] Done. Retry WorkDrawer theme save."
