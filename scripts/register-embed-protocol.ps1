<#
.SYNOPSIS
  One-time, per-user: register the `pem-embed:` URL protocol so the Overview
  "Run indexing" button starts scripts/embed-run.ps1 on this PC.
  Writes HKCU only (no admin). Re-run after moving the repo. -Unregister removes it.
#>
param([switch]$Unregister)

$ErrorActionPreference = "Stop"
$key = "HKCU:\Software\Classes\pem-embed"

if ($Unregister) {
  if (Test-Path $key) { Remove-Item -Path $key -Recurse }
  Write-Host "pem-embed: protocol removed."
  return
}

$script = (Resolve-Path (Join-Path $PSScriptRoot "embed-run.ps1")).Path
$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) { $shell = (Get-Command powershell).Source }

New-Item -Path $key -Force | Out-Null
Set-Item -Path $key -Value "URL:PEM embed worker"
Set-ItemProperty -Path $key -Name "URL Protocol" -Value ""
New-Item -Path "$key\shell\open\command" -Force | Out-Null
# The protocol URL (%1) is deliberately not passed to the script.
Set-Item -Path "$key\shell\open\command" -Value "`"$shell`" -NoProfile -ExecutionPolicy Bypass -File `"$script`""

Write-Host "pem-embed: protocol registered -> $script"
