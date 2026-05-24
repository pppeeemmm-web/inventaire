<#
.SYNOPSIS
  Isolate unrelated WIP, stage intended paths, commit on main, push, restore WIP.

  When -Paths is set (recommended), unrelated modified/untracked files are stashed
  before commit so Cursor never blocks push with "working tree is dirty".

.EXAMPLE
  pwsh scripts/commit-push-main.ps1 -Message "fix: constellation group dropdown" -Paths @(
    'components/atelier/ConstellationCanvas.tsx',
    'components/atelier/team-portal-segment-panel.tsx'
  )

.EXAMPLE
  git add docs/HANDOFF.md
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

function Normalize-GitPath {
  param([string]$Path)
  $Path -replace '\\', '/'
}

function Get-PorcelainPaths {
  $raw = Invoke-Git @("status", "--porcelain")
  if ([string]::IsNullOrWhiteSpace($raw)) { return @() }

  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($line in ($raw -split "`r?`n")) {
    $line = $line.TrimEnd("`r")
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $payload = $null
    if ($line -match '^\?\? (.+)$') {
      $payload = $Matches[1].Trim()
    }
    elseif ($line -match '^.. (.+)$') {
      $payload = $Matches[1].Trim()
    }
    else {
      continue
    }

    if ($payload -match ' -> ') {
      foreach ($part in ($payload -split ' -> ')) {
        [void]$paths.Add((Normalize-GitPath $part.Trim()))
      }
    }
    else {
      [void]$paths.Add((Normalize-GitPath $payload))
    }
  }
  return @($paths)
}

function Write-NulPathspecFile {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Paths
  )

  $stream = [System.IO.File]::Create($FilePath)
  try {
    foreach ($p in $Paths) {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes((Normalize-GitPath $p))
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.WriteByte(0)
    }
  }
  finally {
    $stream.Dispose()
  }
}

function Invoke-GitPathspecCommand {
  param(
    [Parameter(Mandatory = $true)][string[]]$GitArgs,
    [Parameter(Mandatory = $true)][string[]]$Paths
  )

  if ($Paths.Count -eq 0) { return }

  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("git-pathspec-{0}.nul" -f [Guid]::NewGuid().ToString('n'))
  try {
    Write-NulPathspecFile -FilePath $temp -Paths $Paths
  }
  catch {
    Remove-Item $temp -Force -ErrorAction SilentlyContinue
    throw
  }

  try {
    $null = & git -c core.quotepath=false @GitArgs "--pathspec-from-file=$temp" --pathspec-file-nul 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ("git {0} failed (exit {1})" -f ($GitArgs -join " "), $LASTEXITCODE)
    }
  }
  finally {
    Remove-Item $temp -Force -ErrorAction SilentlyContinue
  }
}

function Test-InCommitScope {
  param(
    [string]$File,
    [string[]]$ScopeRoots
  )
  if ($ScopeRoots.Count -eq 0) { return $false }
  $f = Normalize-GitPath $File
  foreach ($root in $ScopeRoots) {
    $r = (Normalize-GitPath $root).TrimEnd('/')
    if ($f -eq $r) { return $true }
    if ($f.StartsWith("$r/")) { return $true }
  }
  return $false
}

function Get-CommitScopeRoots {
  param([string[]]$ExplicitPaths)

  if ($StageAll) { return @() }

  if ($ExplicitPaths.Count -gt 0) {
    return @($ExplicitPaths | ForEach-Object { Normalize-GitPath $_ })
  }

  $staged = Invoke-Git @("diff", "--cached", "--name-only")
  if ([string]::IsNullOrWhiteSpace($staged)) { return @() }
  return @($staged -split "`r?`n" | ForEach-Object { Normalize-GitPath $_.Trim() } | Where-Object { $_ })
}

function Invoke-AsideUnrelatedWork {
  param([string[]]$ScopeRoots)

  if ($StageAll -or $ScopeRoots.Count -eq 0) {
    return $false
  }

  $allPaths = Get-PorcelainPaths
  $aside = @($allPaths | Where-Object { -not (Test-InCommitScope -File $_ -ScopeRoots $ScopeRoots) })
  if ($aside.Count -eq 0) { return $false }

  Write-Host "Aside unrelated WIP ($($aside.Count) path(s)) before commit:" -ForegroundColor Yellow
  $aside | ForEach-Object { Write-Host "  $_" }

  Invoke-GitPathspecCommand -GitArgs @("stash", "push", "-u", "-m", "commit-push-main: unrelated WIP") -Paths $aside
  return $true
}

function Restore-AsideStash {
  param([bool]$DidStash)

  if (-not $DidStash) { return }

  Write-Host "Restoring unrelated WIP (git stash pop)..." -ForegroundColor Yellow
  Invoke-Git @("stash", "pop")
}

$didStash = $false
try {
  $currentBranch = Invoke-Git @("branch", "--show-current")
  if ($currentBranch -ne $TargetBranch) {
    throw "Refusing commit-push: on branch '$currentBranch', expected '$TargetBranch'."
  }

  $scopeRoots = Get-CommitScopeRoots -ExplicitPaths $Paths
  $didStash = Invoke-AsideUnrelatedWork -ScopeRoots $scopeRoots

  if ($StageAll) {
    Invoke-Git @("add", "-A")
  }
  elseif ($Paths.Count -gt 0) {
    Invoke-GitPathspecCommand -GitArgs @("add") -Paths $Paths
  }

  $staged = Invoke-Git @("diff", "--cached", "--name-only")
  if ([string]::IsNullOrWhiteSpace($staged)) {
    throw @"
Nothing staged for commit.
  - Pass -Paths 'rel/path' (repeatable paths in one array), or
  - Run 'git add …' first, then run without -Paths, or
  - Use -StageAll only when every local change belongs in the commit.
"@
  }

  Write-Host "Staged:"
  $staged -split "`r?`n" | ForEach-Object { Write-Host "  $_" }

  Invoke-Git @("commit", "-m", $Message)
  $head = Invoke-Git @("rev-parse", "--short", "HEAD")
  Write-Host "Committed $head"

  $dirty = Invoke-Git @("status", "--porcelain")
  if (-not [string]::IsNullOrWhiteSpace($dirty)) {
    throw @"
Working tree still dirty after commit — push skipped.
Uncommitted paths (stage fully, widen -Paths, or stash manually):
$dirty
"@
  }

  if (-not $NoPush) {
    Invoke-Git @("push", $Remote, $TargetBranch)
    Write-Host "Pushed $head -> $Remote/$TargetBranch"
  }

  $truthParams = @{ Checks = $Checks }
  if (-not $NoPush) { $truthParams.RequirePushed = $true }
  & (Join-Path $PSScriptRoot "release-truth.ps1") @truthParams
}
finally {
  Restore-AsideStash -DidStash:([bool]$didStash)
}
