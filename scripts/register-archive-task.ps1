<#
.SYNOPSIS
  One-time, per-user: a weekly Windows scheduled task that runs the archive export
  (`npm run archive`: images + data + offline page -> %USERPROFILE%\PEM-Archive, or -Out).
  No admin needed. Runs only while you are signed in; if the PC was off at that time, it runs
  at the next sign-in. Re-run after moving the repo. -Unregister removes it.

.EXAMPLE
  pwsh scripts/register-archive-task.ps1
  pwsh scripts/register-archive-task.ps1 -Out "E:\PEM-Archive" -Day Sunday -At "10:00"
  pwsh scripts/register-archive-task.ps1 -Unregister
#>
param(
  [string]$Out = "",
  [string]$Day = "Sunday",
  [string]$At = "10:00",
  [switch]$Unregister
)

$ErrorActionPreference = "Stop"
$name = "PEM archive export"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "$name : task removed."
  return
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$log = Join-Path $env:USERPROFILE "PEM-Archive-last-run.log"
$outArg = if ($Out) { " -- --out `"$Out`"" } else { "" }
$command = "cd /d `"$repo`" && npm run archive$outArg > `"$log`" 2>&1"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $command"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "$name : every $Day at $At -> $(if ($Out) { $Out } else { Join-Path $env:USERPROFILE 'PEM-Archive' })"
Write-Host "Last run log: $log"
