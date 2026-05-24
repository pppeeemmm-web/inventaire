# Slice 7 Phase 2 — sanity-check graph CSV backup workflow (no network).
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'

$workflow = Join-Path $root '.github' 'workflows' 'graph-csv-backup.yml'
$script = Join-Path $root 'scripts' 'backup-graph-csv.sh'

foreach ($f in @($workflow, $script)) {
  if (-not (Test-Path $f)) {
    Write-Error "Missing required file: $f"
  }
}

$wf = Get-Content $workflow -Raw
if ($wf -notmatch 'backup-graph-csv\.sh') {
  Write-Error 'graph-csv-backup.yml does not invoke scripts/backup-graph-csv.sh'
}
if ($wf -notmatch 'SUPABASE_DB_URL') {
  Write-Error 'graph-csv-backup.yml missing SUPABASE_DB_URL secret reference'
}

$sh = Get-Content $script -Raw
if ($sh -notmatch 'public\.entity') {
  Write-Error 'backup-graph-csv.sh missing entity view export'
}
if ($sh -notmatch 'public\.edge_fact') {
  Write-Error 'backup-graph-csv.sh missing edge_fact view export'
}

Write-Host '[graph-csv-backup] Workflow + script structure OK.'
Write-Host '  Schedule: Sundays 04:30 UTC (see graph-csv-backup.yml)'
Write-Host '  Manual run: GitHub Actions → Weekly graph CSV backup → Run workflow'
Write-Host '  Requires secrets: SUPABASE_DB_URL, R2_BACKUP_* (see scripts/backup-graph-csv.sh)'
