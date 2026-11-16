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
#>
param(
  [string]$m = "",
  [switch]$NoPush,
  [switch]$NoChecks
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

function G { $out = & git.exe @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed:`n$($out -join "`n")" }; ($out | Out-String).Trim() }

if ((G branch --show-current) -ne "main") { throw "Refusing: not on main." }

$dirty = G status --porcelain
if ($dirty) {
  if (-not $m) { throw "Changes in the tree but no -m message." }

  if (-not $NoChecks) {
    foreach ($c in @("i18n:check", "atelier:chrome:check", "typecheck", "lint")) {
      $out = & npm run -s $c 2>&1
      if ($LASTEXITCODE -ne 0) { $out | Select-Object -Last 30 | Write-Host; throw "Check failed: $c" }
    }
    Write-Host "Checks: i18n, chrome, typecheck, lint passed"
  }

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
