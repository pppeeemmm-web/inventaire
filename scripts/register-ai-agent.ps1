<#
.SYNOPSIS
  One-time, per user: start the PEM AI agent (scripts/ai-agent/index.mjs) when you sign in to Windows,
  hidden, from this repo. Task Scheduler task « PEM AI agent » for the current user only (no admin).
  -Unregister removes it. -Now also starts it right away.
  The agent picks the jobs queued on Bureau IA (/atelier/ai) and runs them on this PC's models.
#>
param([switch]$Unregister, [switch]$Now)

$ErrorActionPreference = "Stop"
$name = "PEM AI agent"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "$name removed."
  return
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "scripts\ai-agent\index.mjs" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# No time limit (it keeps running); restart it if it stops with an error.
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "Runs the AI jobs queued on Bureau IA, on this PC" -Force | Out-Null
Write-Host "$name registered: starts at sign-in from $repo"

if ($Now) {
  Start-ScheduledTask -TaskName $name
  Write-Host "$name started."
}
