param()

$ErrorActionPreference = "Stop"

function Write-HookJson {
  param(
    [string]$Permission = "allow",
    [string]$UserMessage = "",
    [string]$AgentMessage = ""
  )

  # Claude Code PreToolUse: exit 2 blocks the call and shows stderr; exit 0 with no output allows.
  # (The old {"permission":"deny"} JSON was Cursor's format; Claude Code ignored it.)
  if ($Permission -eq "deny") {
    [Console]::Error.WriteLine("$UserMessage $AgentMessage".Trim())
    exit 2
  }
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

function Test-IsPushCommand {
  param([string]$Command)

  return $Command -match "(^|[;&|]\s*)git\s+push(\s|$)"
}

function Test-IsForcePush {
  param([string]$Command)

  return $Command -match "\s(--force|-f|--force-with-lease)(\s|$)"
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

try {
  $inputObject = Get-HookInput
  $command = Get-CommandText $inputObject

  if (-not (Test-IsPushCommand $command)) {
    Write-HookJson
    exit 0
  }

  if (Test-IsForcePush $command) {
    Write-HookJson -Permission "deny" `
      -UserMessage "Push blocked: force push is not allowed without explicit owner approval." `
      -AgentMessage "Do not force push unless the owner explicitly requested it in this turn."
    exit 0
  }

  Push-Location (Get-RepoRoot)
  try {
    $branch = (& git branch --show-current 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
      Write-HookJson -Permission "deny" `
        -UserMessage "Push blocked: could not determine the current branch." `
        -AgentMessage "Inspect git branch state before pushing."
      exit 0
    }

    if ($branch -ne "main") {
      Write-HookJson -Permission "deny" `
        -UserMessage "Push blocked: current branch is '$branch', not 'main'." `
        -AgentMessage "This repo treats origin/main as release truth. Only push other branches when explicitly requested."
      exit 0
    }

    $dirty = & git status --porcelain 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-HookJson -Permission "deny" `
        -UserMessage "Push blocked: could not read working tree status." `
        -AgentMessage "Run git status before pushing."
      exit 0
    }

    if (-not [string]::IsNullOrWhiteSpace(($dirty | Out-String))) {
      Write-HookJson -Permission "deny" `
        -UserMessage "Push blocked: working tree is dirty." `
        -AgentMessage "Commit or explicitly leave local draft files before pushing."
      exit 0
    }
  } finally {
    Pop-Location
  }

  Write-HookJson
  exit 0
} catch {
  Write-HookJson -Permission "deny" `
    -UserMessage "Pre-push guard failed before it could verify safety." `
    -AgentMessage "The pre-push guard encountered an error. Inspect `.claude/hooks/pre-push-checks.ps1` before pushing."
  exit 0
}
