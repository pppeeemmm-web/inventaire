<#
.SYNOPSIS
  Main session lands a side session's worktree into local main (owner 2026-11-16: the main session controls commits and merges).
.DESCRIPTION
  Side sessions edit in their worktree and leave the work UNCOMMITTED; this script, run from the main checkout:
    1. commits whatever is left in the worktree (git add -A, refuses build artifacts) with -m;
    2. rebases the worktree branch onto local main (stops on conflict, rebase aborted, nothing lost);
    3. fast-forwards main to it.
  Nothing is pushed: `& .\scripts\ship.ps1` pushes the whole batch once (it runs the checks first).
  The worktree folder itself is left to the app (archiving the side session cleans it up).
.EXAMPLE
  & .\scripts\land.ps1 small-gifs -m "feat(atelier): ..."     # worktree folder name, or a part of it
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Worktree,
  [string]$m = ""
)

$ErrorActionPreference = "Stop"
$main = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $main

function G { $out = & git.exe @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed:`n$($out -join "`n")" }; ($out | Out-String).Trim() }

if ((G branch --show-current) -ne "main") { throw "Refusing: main checkout is not on main." }
if (G status --porcelain) { throw "Refusing: main checkout has uncommitted changes; commit them first (ship.ps1 -NoPush)." }

# Find the worktree: exact path, or the one whose folder name contains $Worktree.
$list = @((G worktree list --porcelain) -split "`r?`n" | Where-Object { $_ -like 'worktree *' } | ForEach-Object { $_.Substring(9) })
$wt = if (Test-Path -LiteralPath $Worktree) { (Resolve-Path $Worktree).Path -replace '\\', '/' } else {
  $hits = @($list | Where-Object { (Split-Path $_ -Leaf) -like "*$Worktree*" })
  if ($hits.Count -ne 1) { throw "Worktree '$Worktree': $($hits.Count) match(es). Known: $($list -join ', ')" }
  $hits[0]
}
$branch = G -C $wt branch --show-current
if (-not $branch -or $branch -eq "main") { throw "Refusing: worktree $wt is on '$branch'." }

# 1. Commit what the side session left.
if (G -C $wt status --porcelain) {
  if (-not $m) { throw "Worktree has uncommitted changes: pass -m 'message'." }
  if ($m -match '^(feat|fix)(\(|:|!)' -and $m -notmatch '(?m)^Flow:\s*\S') {
    throw "Refusing: feat/fix message without a 'Flow:' line (readers checked, after the flow-reviewer pass). Add e.g. 'Flow: writer X, readers Y and Z updated' or 'Flow: none — copy only'."
  }
  G -C $wt add -A | Out-Null
  $staged = @((G -C $wt diff --cached --name-only) -split "`r?`n" | Where-Object { $_ })
  $bad = @($staged | Where-Object { $_ -match '(^|/)(\.next|node_modules|test-results|playwright-report)/' -or $_ -match 'tsbuildinfo$|\.log$' })
  if ($bad.Count) { G -C $wt reset -q | Out-Null; throw "Refusing: artifacts staged in worktree: $($bad -join ', ')" }
  G -C $wt commit -q -m $m | Out-Null
  Write-Host "Committed in $branch ($($staged.Count) file(s))"
}
elseif ($m) { Write-Host "Worktree clean: -m ignored (its commits are landed as they are)." -ForegroundColor DarkYellow }

# 2. Rebase onto local main.
& git.exe -C $wt rebase -q main 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  $conf = (& git.exe -C $wt diff --name-only --diff-filter=U) -join ', '
  & git.exe -C $wt rebase --abort 2>&1 | Out-Null
  throw "Rebase of $branch onto main hit conflicts ($conf); rebase aborted, nothing changed. Resolve in the worktree, then land again."
}

# 3. Fast-forward main.
$n = G rev-list --count "main..$branch"
if ($n -eq "0") { Write-Host "Nothing new in $branch."; exit 0 }

# The architect reads what it lands (owner GO 2026-11-18): the diff is printed, capped so a big one stays readable.
$diff = @((G diff "main..$branch") -split "`r?`n")
$cap = 400
Write-Host "----- diff being landed ($($diff.Count) lines) -----"
$diff | Select-Object -First $cap | Write-Host
if ($diff.Count -gt $cap) { Write-Host "... $($diff.Count - $cap) more lines: git diff main..$branch" }
Write-Host "----- end of diff -----"

G merge -q --ff-only $branch | Out-Null
$files = @((G diff --name-only "HEAD~$n" HEAD) -split "`r?`n" | Where-Object { $_ })
Write-Host "Landed $n commit(s) from $branch ($($files.Count) file(s)); committed locally $(G rev-parse --short HEAD)"
$files | ForEach-Object { Write-Host "  $_" }
