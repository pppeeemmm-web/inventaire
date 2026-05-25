<#
.SYNOPSIS
  Fast scoped commit + push on main. Moves unrelated WIP aside (not stash), then restores.

.EXAMPLE
  & .\scripts\commit-push-main.ps1 -Message "fix: foo" -Paths @('components/Foo.tsx')
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

function Invoke-AsideUnrelatedWork {
  param([string[]]$ScopeRoots)

  if ($StageAll -or $ScopeRoots.Count -eq 0) { return $false }

  $aside = @((Get-PorcelainPaths) | Where-Object { -not (Test-InCommitScope -File $_ -ScopeRoots $ScopeRoots) })
  if ($aside.Count -eq 0) { return $false }

  $script:AsideRoot = Join-Path $env:TEMP ("pem-wip-{0}" -f [Guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Force -Path $script:AsideRoot | Out-Null

  foreach ($rel in $aside) {
    $src = Join-Path $repoRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dest = Join-Path $script:AsideRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Move-Item -LiteralPath $src -Destination $dest -Force
    $script:AsideManifest += $rel
  }

  if ($script:AsideManifest.Count -eq 0) {
    Remove-Item $script:AsideRoot -Recurse -Force -ErrorAction SilentlyContinue
    $script:AsideRoot = $null
    return $false
  }

  Write-Host ("Aside {0} unrelated path(s)" -f $script:AsideManifest.Count) -ForegroundColor DarkYellow
  return $true
}

function Restore-AsideWork {
  if (-not $script:AsideRoot -or $script:AsideManifest.Count -eq 0) { return }

  foreach ($rel in $script:AsideManifest) {
    $src = Join-Path $script:AsideRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dest = Join-Path $repoRoot ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Move-Item -LiteralPath $src -Destination $dest -Force
  }

  Remove-Item $script:AsideRoot -Recurse -Force -ErrorAction SilentlyContinue
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
