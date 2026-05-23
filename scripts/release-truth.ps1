param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [string]$Checks = "",
  [switch]$RequirePushed
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

$headEqualsRemote = ($headSha -eq $remoteSha)
$workingTree = if ([string]::IsNullOrWhiteSpace($dirty)) { "clean" } else { "dirty" }

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

if (-not [string]::IsNullOrWhiteSpace($dirty)) {
  Write-Output ""
  Write-Output "Uncommitted files"
  Write-Output "-----------------"
  Write-Output $dirty
}

if ($RequirePushed -and -not $headEqualsRemote) {
  Write-Error "Required pushed state failed: HEAD does not equal $remoteRef."
  exit 1
}
