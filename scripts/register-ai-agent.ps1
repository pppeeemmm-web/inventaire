<#
.SYNOPSIS
  One-time, per user: start the PEM AI agent (scripts/ai-agent/index.mjs) when you sign in to Windows,
  with NO window (scripts/ai-agent/start-hidden.vbs), from this repo. -Stop stops a running agent. Task Scheduler task « PEM AI agent » for the current user only (no admin).
  -Unregister removes it. -Now also starts it right away.
  The agent picks the jobs queued on Bureau IA (/atelier/ai) and runs them on this PC's models.
#>
param([switch]$Unregister, [switch]$Now, [switch]$Stop)

$ErrorActionPreference = "Stop"
$name = "PEM AI agent"

if ($Stop -or $Unregister) {
  # The agent runs as node.exe with scripts/ai-agent/index.mjs on its command line: stop only that one.
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*ai-agent*index.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "PEM AI agent stopped (pid $($_.ProcessId))." }
  if ($Stop) { return }
}

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "$name removed."
  return
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$vbs = Join-Path $repo "scripts\ai-agent\start-hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# No time limit (it keeps running); restart it if it stops with an error.
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "Runs the AI jobs queued on Bureau IA, on this PC" -Force | Out-Null
Write-Host "$name registered: starts at sign-in from $repo"

if ($Now) {
  # Replace an agent already running in a window by the hidden one.
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*ai-agent*index.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-ScheduledTask -TaskName $name
  Write-Host "$name started."
}
