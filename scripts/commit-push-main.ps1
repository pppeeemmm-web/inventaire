<#
.SYNOPSIS
  Fast scoped commit + push on main. Untracked WIP moved aside; tracked WIP stashed (paths only).
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Message,

  [string[]]$Paths = @(),

  [switch]$StageAll,

  [switch]$NoPush,

  [switch]$Verify,

  [string]$Checks = "",

  [string]$Remote = "origin",
  [string]$TargetBranch = "main"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$script:AsideRoot = $null
$script:AsideManifest = @()
$script:DidStashTracked = $false

function Invoke-Git {
  param([Parameter(Mandatory = $true)][string[]]$Args)
  $out = & git @Args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("git {0} failed (exit {1}):{2}{3}" -f ($Args -join " "), $LASTEXITCODE, [Environment]::NewLine, ($out -join [Environment]::NewLine))
  }
  if ($out) { return ($out | Out-String).Trim() }
  return ""
}

function Normalize-GitPath { param([string]$Path) $Path -replace '\\', '/' }

function Get-LiteralGitPath {
  param([string]$Path)
  $p = Normalize-GitPath $Path
  if ($p.StartsWith('.') -and -not $p.StartsWith('./')) { return "./$p" }
  return $p
}

function Get-PorcelainPaths {
  $raw = Invoke-Git @("status", "--porcelain")
  if ([string]::IsNullOrWhiteSpace($raw)) { return @() }

  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($line in ($raw -split "`r?`n")) {
    $line = $line.TrimEnd("`r")
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $payload = $null
    if ($line -match '^\?\? (.+)$') { $payload = $Matches[1].Trim() }
    elseif ($line -match '^.. (.+)$') { $payload = $Matches[1].Trim() }
    else { continue }

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

function Test-TrackedPath {
  param([string]$RelPath)
  $literal = Get-LiteralGitPath $RelPath
  & git ls-files --error-unmatch -- $literal 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Test-InCommitScope {
  param([string]$File, [string[]]$ScopeRoots)
  if ($ScopeRoots.Count -eq 0) { return $false }
  $f = Normalize-GitPath $File
  foreach ($root in $ScopeRoots) {
    $r = (Normalize-GitPath $root).TrimEnd('/')
    if ($f -eq $r -or $f.StartsWith("$r/")) { return $true }
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

function Move-AsideUntracked {
  param([string[]]$Paths)

  if ($Paths.Count -eq 0) { return }

  $script:AsideRoot = Join-Path $env:TEMP ("pem-wip-{0}" -f [Guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Force -Path $script:AsideRoot | Out-Null

  foreach ($rel in $Paths) {
    $src = Join-Path $repoRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dest = Join-Path $script:AsideRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Move-Item -LiteralPath $src -Destination $dest -Force
    $script:AsideManifest += $rel
  }
}

function Invoke-AsideUnrelatedWork {
  param([string[]]$ScopeRoots)

  if ($StageAll -or $ScopeRoots.Count -eq 0) { return $false }

  $aside = @((Get-PorcelainPaths) | Where-Object { -not (Test-InCommitScope -File $_ -ScopeRoots $ScopeRoots) })
  if ($aside.Count -eq 0) { return $false }

  $tracked = @($aside | Where-Object { Test-TrackedPath $_ })
  $untracked = @($aside | Where-Object { -not (Test-TrackedPath $_) })

  if ($untracked.Count -gt 0) { Move-AsideUntracked -Paths $untracked }

  if ($tracked.Count -gt 0) {
    $literal = @($tracked | ForEach-Object { Get-LiteralGitPath $_ })
    & git stash push -m "commit-push-main: tracked WIP" -- @literal
    if ($LASTEXITCODE -ne 0) { throw "git stash push failed (exit $LASTEXITCODE)" }
    $script:DidStashTracked = $true
  }

  $n = $untracked.Count + $tracked.Count
  if ($n -gt 0) { Write-Host ("Aside $n unrelated path(s)" -f $n) -ForegroundColor DarkYellow }
  return ($n -gt 0)
}

function Restore-AsideWork {
  if ($script:AsideManifest.Count -gt 0 -and $script:AsideRoot) {
    foreach ($rel in $script:AsideManifest) {
      $src = Join-Path $script:AsideRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
      if (-not (Test-Path -LiteralPath $src)) { continue }
      $dest = Join-Path $repoRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
      New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
      Move-Item -LiteralPath $src -Destination $dest -Force
    }
    Remove-Item $script:AsideRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  if ($script:DidStashTracked) {
    Invoke-Git @("stash", "pop")
    $script:DidStashTracked = $false
  }

  $script:AsideRoot = $null
  $script:AsideManifest = @()
}

$didAside = $false
try {
  if ((Invoke-Git @("branch", "--show-current")) -ne $TargetBranch) {
    throw "Refusing: not on $TargetBranch."
  }

  $scopeRoots = Get-CommitScopeRoots -ExplicitPaths $Paths
  $didAside = Invoke-AsideUnrelatedWork -ScopeRoots $scopeRoots

  if ($StageAll) {
    Invoke-Git @("add", "-A")
  }
  elseif ($Paths.Count -gt 0) {
    $literal = @($Paths | ForEach-Object { Get-LiteralGitPath $_ })
    & git add -- @literal
    if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }
  }

  $staged = Invoke-Git @("diff", "--cached", "--name-only")
  if ([string]::IsNullOrWhiteSpace($staged)) {
    throw "Nothing staged. Pass -Paths or git add first."
  }

  Invoke-Git @("commit", "-m", $Message)
  $head = Invoke-Git @("rev-parse", "--short", "HEAD")
  Write-Host "Committed $head"

  if (-not [string]::IsNullOrWhiteSpace((Invoke-Git @("status", "--porcelain")))) {
    throw "Working tree still dirty after commit — push skipped."
  }

  if (-not $NoPush) {
    Invoke-Git @("push", $Remote, $TargetBranch)
    Write-Host "Pushed $head -> $Remote/$TargetBranch"
  }

  if ($Verify) {
    $truthParams = @{ Checks = $Checks }
    if (-not $NoPush) { $truthParams.RequirePushed = $true }
    & (Join-Path $PSScriptRoot "release-truth.ps1") @truthParams
  }
}
finally {
  if ($didAside) { Restore-AsideWork }
}
