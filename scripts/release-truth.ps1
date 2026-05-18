param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [string]$Checks = "",
  [string]$DeploySha = "",
  [switch]$RequirePushed,
  [switch]$RequireDeploy
)

$ErrorActionPreference = "Stop"

function Write-Field {
  param(
    [string]$Name,
    [string]$Value
  )
  Write-Output ("{0}: {1}" -f $Name, $Value)
}

function Git-Text {
  param([string[]]$GitArgs)
  $output = & git @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("git {0} failed: {1}" -f ($GitArgs -join " "), ($output -join "`n"))
  }
  return (($output | Out-String).Trim())
}

$remoteRef = "$Remote/$Branch"
$fetchStatus = "ok"

try {
  & git fetch $Remote $Branch --quiet 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $fetchStatus = "failed"
  }
} catch {
  $fetchStatus = "failed"
}

$currentBranch = Git-Text @("branch", "--show-current")
$headSha = Git-Text @("rev-parse", "HEAD")
$remoteSha = Git-Text @("rev-parse", $remoteRef)
$dirty = Git-Text @("status", "--porcelain")
$ahead = Git-Text @("rev-list", "--count", "$remoteRef..HEAD")
$behind = Git-Text @("rev-list", "--count", "HEAD..$remoteRef")

if ([string]::IsNullOrWhiteSpace($DeploySha) -and -not [string]::IsNullOrWhiteSpace($env:VERCEL_GIT_COMMIT_SHA)) {
  $DeploySha = $env:VERCEL_GIT_COMMIT_SHA
}

$headEqualsRemote = ($headSha -eq $remoteSha)
$workingTree = if ([string]::IsNullOrWhiteSpace($dirty)) { "clean" } else { "dirty" }
$deployStatus = if ([string]::IsNullOrWhiteSpace($DeploySha)) {
  "unknown"
} elseif ($DeploySha -eq $remoteSha) {
  "matches origin/main"
} else {
  "differs from origin/main"
}

Write-Output "Release Truth"
Write-Output "-------------"
Write-Field "fetch" $fetchStatus
Write-Field "branch" $currentBranch
Write-Field "HEAD" $headSha
Write-Field $remoteRef $remoteSha
Write-Field "HEAD == $remoteRef" $headEqualsRemote.ToString().ToLowerInvariant()
Write-Field "ahead" $ahead
Write-Field "behind" $behind
Write-Field "working tree" $workingTree
Write-Field "checks" $(if ([string]::IsNullOrWhiteSpace($Checks)) { "not provided" } else { $Checks })
Write-Field "deploy SHA" $(if ([string]::IsNullOrWhiteSpace($DeploySha)) { "not provided" } else { $DeploySha })
Write-Field "deploy status" $deployStatus

if (-not [string]::IsNullOrWhiteSpace($dirty)) {
  Write-Output ""
  Write-Output "Uncommitted files"
  Write-Output "-----------------"
  Write-Output $dirty
}

$failed = $false

if ($RequirePushed -and -not $headEqualsRemote) {
  Write-Error "Required pushed state failed: HEAD does not equal $remoteRef."
  $failed = $true
}

if ($RequireDeploy) {
  if ([string]::IsNullOrWhiteSpace($DeploySha)) {
    Write-Error "Required deploy state failed: deploy SHA was not provided."
    $failed = $true
  } elseif ($DeploySha -ne $remoteSha) {
    Write-Error "Required deploy state failed: deploy SHA does not equal $remoteRef."
    $failed = $true
  }
}

if ($failed) {
  exit 1
}
