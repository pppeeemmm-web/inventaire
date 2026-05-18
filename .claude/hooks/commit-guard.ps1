param()

$ErrorActionPreference = "Stop"

function Write-HookJson {
  param(
    [string]$Permission = "allow",
    [string]$UserMessage = "",
    [string]$AgentMessage = ""
  )

  $payload = [ordered]@{
    permission = $Permission
  }

  if (-not [string]::IsNullOrWhiteSpace($UserMessage)) {
    $payload.user_message = $UserMessage
  }

  if (-not [string]::IsNullOrWhiteSpace($AgentMessage)) {
    $payload.agent_message = $AgentMessage
  }

  $payload | ConvertTo-Json -Compress
}

function Get-HookInput {
  try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return $null
    }
    return $raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-CommandText {
  param($InputObject)

  if ($null -eq $InputObject) {
    return ""
  }

  $candidates = @(
    $InputObject.command,
    $InputObject.tool_input.command,
    $InputObject.input.command
  )

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
      return [string]$candidate
    }
  }

  return ""
}

function Test-IsCommitCommand {
  param([string]$Command)

  return $Command -match "(^|[;&|]\s*)git\s+commit(\s|$)"
}

function Get-RepoRoot {
  try {
    $root = & git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($root)) {
      return ($root | Select-Object -First 1)
    }
  } catch {}

  return $PWD.Path
}

function Get-StagedSourceFiles {
  $files = & git diff --cached --name-only --diff-filter=ACMRT 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $files) {
    return @()
  }

  return @($files | Where-Object {
    $_ -match "\.(ts|tsx|js|jsx|mjs|cjs|css|scss|md|mdx|mdc|json|sql|ps1|yml|yaml)$" -and
    $_ -notmatch "(^|/)(\.next|node_modules|test-results|playwright-report)/" -and
    $_ -ne "tsconfig.tsbuildinfo"
  })
}

function Get-UnstagedSourceFiles {
  $files = & git diff --name-only --diff-filter=ACMRT 2>$null
  if ($LASTEXITCODE -ne 0 -or $null -eq $files) {
    return @()
  }

  return @($files | Where-Object {
    $_ -match "\.(ts|tsx|js|jsx|mjs|cjs|css|scss|md|mdx|mdc|json|sql|ps1|yml|yaml)$" -and
    $_ -notmatch "(^|/)(\.next|node_modules|test-results|playwright-report)/" -and
    $_ -ne "tsconfig.tsbuildinfo"
  })
}

try {
  $inputObject = Get-HookInput
  $command = Get-CommandText $inputObject

  if (-not (Test-IsCommitCommand $command)) {
    Write-HookJson
    exit 0
  }

  Push-Location (Get-RepoRoot)
  try {
    $staged = Get-StagedSourceFiles
    if ($staged.Count -eq 0) {
      Write-HookJson -Permission "deny" `
        -UserMessage "Commit blocked: no staged source files were found." `
        -AgentMessage "Stage the intended source files before committing, and do not commit build artifacts."
      exit 0
    }

    $unstaged = Get-UnstagedSourceFiles
    if ($unstaged.Count -gt 0) {
      $shown = ($unstaged | Select-Object -First 12) -join ", "
      Write-HookJson -Permission "deny" `
        -UserMessage "Commit blocked: unstaged source files remain: $shown" `
        -AgentMessage "Run git diff --stat, decide whether these source files belong in the commit, and stage all intended source changes before committing."
      exit 0
    }
  } finally {
    Pop-Location
  }

  Write-HookJson
  exit 0
} catch {
  Write-HookJson -Permission "deny" `
    -UserMessage "Commit guard failed before it could verify safety." `
    -AgentMessage "The commit guard encountered an error. Inspect `.claude/hooks/commit-guard.ps1` before committing."
  exit 0
}
