<#
.SYNOPSIS
  Lean commit + push on main (owner 2026-11-16). One call: checks -> git add -A -> commit -> push.
.DESCRIPTION
  One writing session per checkout (CLAUDE.md), so everything in the tree belongs to the change: no WIP juggling.
  Nothing staged but commits ahead of origin -> just pushes them (a batch of local commits, one deploy).
  Prints the exact status word at the end: `committed locally` or `pushed to origin/main`.
.EXAMPLE
  & .\scripts\ship.ps1 -m "fix(atelier): ..."            # checks, commit, push
  & .\scripts\ship.ps1 -m "fix(atelier): ..." -NoPush    # checks, commit only (push later with: & .\scripts\ship.ps1)
  & .\scripts\ship.ps1                                     # push the local commits already made
  & .\scripts\ship.ps1 -NoWhatsNew                         # push feat/fix commits that have no team-facing effect
  feat/fix messages need a 'Flow:' line (readers checked) — refused otherwise.
#>
param(
  [string]$m = "",
  [switch]$NoPush,
  [switch]$NoChecks,
  [switch]$NoWhatsNew
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

function G { $out = & git.exe @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed:`n$($out -join "`n")" }; ($out | Out-String).Trim() }

if ((G branch --show-current) -ne "main") { throw "Refusing: not on main." }

$dirty = G status --porcelain
if ($dirty -and -not $m) { throw "Changes in the tree but no -m message." }
$willPush = -not $NoPush -and ($dirty -or (G rev-list --count origin/main..HEAD) -ne "0")

# What's new (owner GO 2026-11-18): a push carrying feat/fix commits must carry a lib/whats-new.ts change.
# Admin-only or internal changes (no team-facing effect) pass with -NoWhatsNew.
if ($willPush -and -not $NoWhatsNew) {
  $subjects = @((G log --format=%s origin/main..HEAD) -split "`r?`n" | Where-Object { $_ })
  if ($dirty) { $subjects += $m }
  $teamFacing = @($subjects | Where-Object { $_ -match '^(feat|fix)(\(|:|!)' })
  if ($teamFacing.Count) {
    $changed = @((G diff --name-only origin/main..HEAD) -split "`r?`n") + @((G status --porcelain) -split "`r?`n" | ForEach-Object { if ($_.Length -gt 3) { $_.Substring(3) } })
    if (-not ($changed -contains 'lib/whats-new.ts')) {
      throw "Refusing: $($teamFacing.Count) feat/fix commit(s) in this push but no lib/whats-new.ts change. Add the What's new item (FR + EN), or pass -NoWhatsNew for an admin-only / internal change.`n  $($teamFacing -join "`n  ")"
    }
  }
}

# Flow trace (owner GO 2026-11-18): every feat/fix commit message carries a `Flow:` line naming the readers
# checked (`Flow: none — copy only` is fine). Commits authored before the rule landed are exempt.
$flowSince = [DateTimeOffset]::Parse('2026-11-18T16:15:00+01:00')
if ($dirty -and $m -match '^(feat|fix)(\(|:|!)' -and $m -notmatch '(?m)^Flow:\s*\S') {
  throw "Refusing: feat/fix message without a 'Flow:' line (readers checked). Add e.g. 'Flow: actions.ts writer, Sales pivot, collector PDF updated' or 'Flow: none — copy only'."
}
if ($willPush) {
  $noFlow = @(((G log --format='%aI%x1f%h %s%x1f%B%x1e' origin/main..HEAD) -split [char]0x1e) | Where-Object { $_.Trim() } | ForEach-Object {
    $p = $_.Trim() -split [char]0x1f
    if ($p.Count -ge 3 -and [DateTimeOffset]::Parse($p[0]) -ge $flowSince -and $p[1] -match '^\w+ (feat|fix)(\(|:|!)' -and $p[2] -notmatch '(?m)^Flow:\s*\S') { $p[1] }
  })
  if ($noFlow.Count) {
    throw "Refusing: $($noFlow.Count) feat/fix commit(s) without a 'Flow:' line (readers checked). Amend the message (last commit: git commit --amend) before pushing:`n  $($noFlow -join "`n  ")"
  }
}

# Checks before any commit and before any push (landed worktree commits included), ~10 s.
if (-not $NoChecks -and ($dirty -or $willPush)) {
  foreach ($c in @("i18n:check", "atelier:chrome:check", "docs:routes:check", "typecheck", "lint")) {
    $out = & npm run -s $c 2>&1
    if ($LASTEXITCODE -ne 0) { $out | Select-Object -Last 30 | Write-Host; throw "Check failed: $c" }
  }
  Write-Host "Checks: i18n, chrome, routes in SITE_MAP, typecheck, lint passed"
}

# Work rule checks (docs/WORK_RULES.md §6, Pem's GO 2026-11-17): before a push, read only, only when a
# DB URL is set locally (env or .env.local SUPABASE_DB_URL) and psql is installed. Breaks are a warning,
# never a block; a missing URL or psql never blocks a push.
if ($willPush) {
  $dbUrl = $env:SUPABASE_DB_URL
  if (-not $dbUrl -and (Test-Path .env.local)) {
    $line = Get-Content .env.local | Where-Object { $_ -match '^\s*SUPABASE_DB_URL\s*=' } | Select-Object -First 1
    if ($line) { $dbUrl = ($line -replace '^\s*SUPABASE_DB_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
  }
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $dbUrl) { Write-Host "rule checks skipped (no DB URL)" }
  elseif (-not $psql) { Write-Host "rule checks skipped (no psql)" }
  else {
    $sql = "begin;`nset transaction read only;`nset local statement_timeout = '120s';`n" + (Get-Content -Raw supabase/sql/work_rules_checks.sql) + "`nrollback;`n"
    $rows = @($sql | & $psql.Source $dbUrl -X -q -A -t -F ' | ' -v ON_ERROR_STOP=1 -f - 2>&1 | Where-Object { "$_".Trim() })
    if ($LASTEXITCODE -ne 0) { Write-Host "rule checks could not run (psql exit $LASTEXITCODE) — not blocking"; $rows | Select-Object -First 5 | Write-Host }
    elseif ($rows.Count) { Write-Host "WARNING rule checks: $($rows.Count) break(s) — rule | work | title | detail:"; $rows | Write-Host }
    else { Write-Host "Rule checks: all rules hold" }
  }
}

if ($dirty) {

  G add -A | Out-Null
  $staged = @((G diff --cached --name-only) -split "`r?`n" | Where-Object { $_ })
  $bad = @($staged | Where-Object { $_ -match '(^|/)(\.next|node_modules|test-results|playwright-report)/' -or $_ -match 'tsbuildinfo$' })
  if ($bad.Count) { G reset -q | Out-Null; throw "Refusing: build artifacts staged: $($bad -join ', ')" }
  Write-Host "Staged ($($staged.Count)):"; $staged | ForEach-Object { Write-Host "  $_" }

  G commit -q -m $m | Out-Null
}
elseif ($m) { throw "Nothing to commit." }

$head = G rev-parse --short HEAD
if ($NoPush) { Write-Host "committed locally $head"; exit 0 }

$ahead = G rev-list --count origin/main..HEAD
if ($ahead -eq "0") { Write-Host "Nothing to push: HEAD $head == origin/main"; exit 0 }

G push -q origin main | Out-Null
$remote = G rev-parse --short origin/main
if ($remote -ne $head) { throw "Push ran but origin/main ($remote) != HEAD ($head)." }
Write-Host "pushed to origin/main $head ($ahead commit(s)); working tree clean"
