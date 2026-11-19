<#
.SYNOPSIS
  One-time, per user (no admin, HKCU + your own Task Scheduler only):
  - the `pem-ai:` link: Bureau IA's « Lancer sur ce PC » / « Faire maintenant » start the agent on this PC;
  - the Task Scheduler task « PEM AI agent »: one pass at Windows sign-in.
  Both run scripts/ai-agent/start-hidden.vbs: the agent (scripts/ai-agent/index.mjs) does what is waiting on
  Bureau IA (/atelier/ai), with no window, then stops. -Now also starts a pass right away. -Stop stops a running
  agent. -Unregister removes the task and the link. Re-run after moving the repo.
#>
param([switch]$Unregister, [switch]$Now, [switch]$Stop)

$ErrorActionPreference = "Stop"
$name = "PEM AI agent"
$protocolKey = "HKCU:\Software\Classes\pem-ai"

# The hidden launcher (wscript running start-hidden.vbs) restarts node when it stops: end the launcher first, then node.
function Stop-PemAgent {
  Get-CimInstance Win32_Process -Filter "Name = 'wscript.exe'" |
    Where-Object { $_.CommandLine -like '*start-hidden.vbs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*ai-agent*index.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "PEM AI agent stopped (pid $($_.ProcessId))." }
}

if ($Stop -or $Unregister) {
  Stop-PemAgent
  if ($Stop) { return }
}

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  if (Test-Path $protocolKey) { Remove-Item -Path $protocolKey -Recurse }
  Write-Host "$name and the pem-ai: link removed."
  return
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$vbs = Join-Path $repo "scripts\ai-agent\start-hidden.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# One pass, then it stops: no restarts. Two hours is far above any pass (Whisper on a long backlog included).
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description "One pass of the AI jobs queued on Bureau IA, on this PC, at sign-in" -Force | Out-Null
Write-Host "$name registered: one pass at sign-in, from $repo"

# The pem-ai: link (same way as pem-embed:, scripts/register-embed-protocol.ps1). The URL itself is not passed on.
New-Item -Path $protocolKey -Force | Out-Null
Set-Item -Path $protocolKey -Value "URL:PEM AI agent"
Set-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value ""
New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
Set-Item -Path "$protocolKey\shell\open\command" -Value "wscript.exe `"$vbs`""
Write-Host "pem-ai: link registered -> $vbs"

if ($Now) {
  # Replace an agent already running (in a window, or an older hidden one) by the hidden one.
  Stop-PemAgent
  Start-ScheduledTask -TaskName $name
  Write-Host "$name started."
}
