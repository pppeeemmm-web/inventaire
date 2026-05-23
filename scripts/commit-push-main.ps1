<#
.SYNOPSIS
  Stage (optional), commit on main, verify working tree is clean, then push.

  Avoids Cursor "Push blocked: working tree is dirty" from chained commit; push
  when commit failed or left unstaged files.

.EXAMPLE
  pwsh scripts/commit-push-main.ps1 -Message "fix: inventory i18n titles" -Paths @(
    'app/atelier/inventory/_components/Inventory.tsx',
    'lib/i18n/messages/inventory-ui.messages.ts'
  )

.EXAMPLE
  git add -A docs/
  pwsh scripts/commit-push-main.ps1 -Message "docs: handoff" 
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Message,

  [string[]]$Paths = @(),

  [switch]$StageAll,

  [switch]$NoPush,

  [string]$Checks = "",

  [string]$Remote = "origin",
  [string]$TargetBranch = "main"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Args)
  $out = & git @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("git {0} failed (exit {1}):{2}{3}" -f ($Args -join " "), $LASTEXITCODE, [Environment]::NewLine, ($out -join [Environment]::NewLine))
  }
  if ($out) { return ($out | Out-String).Trim() }
  return ""
}

$currentBranch = Invoke-Git @("branch", "--show-current")
if ($currentBranch -ne $TargetBranch) {
  throw "Refusing commit-push: on branch '$currentBranch', expected '$TargetBranch'."
}

if ($StageAll) {
  Invoke-Git @("add", "-A")
}
elseif ($Paths.Count -gt 0) {
  & git add -- @Paths
  if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }
}

$staged = Invoke-Git @("diff", "--cached", "--name-only")
if ([string]::IsNullOrWhiteSpace($staged)) {
  throw @"
Nothing staged for commit.
  - Pass -Paths 'rel/path' (repeatable paths in one array), or
  - Run 'git add …' first, or
  - Use -StageAll only when you intend every change in the repo.
"@
}

Write-Host "Staged:"
$staged -split "`n" | ForEach-Object { Write-Host "  $_" }

Invoke-Git @("commit", "-m", $Message)
$head = Invoke-Git @("rev-parse", "--short", "HEAD")
Write-Host "Committed $head"

$dirty = Invoke-Git @("status", "--porcelain")
if (-not [string]::IsNullOrWhiteSpace($dirty)) {
  Write-Host ""
  Write-Host "ERROR: Working tree still dirty after commit — push skipped." -ForegroundColor Red
  Write-Host "Uncommitted paths (commit or stash these, then push manually):"
  Write-Host $dirty
  exit 1
}

if (-not $NoPush) {
  Invoke-Git @("push", $Remote, $TargetBranch)
  Write-Host "Pushed $head -> $Remote/$TargetBranch"
}

$truthParams = @{
  Checks = $Checks
}
if (-not $NoPush) { $truthParams.RequirePushed = $true }
& (Join-Path $PSScriptRoot "release-truth.ps1") @truthParams
