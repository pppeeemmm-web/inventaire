<#
.SYNOPSIS
  Image description batch (gemma3:4b, owner GO 2026-11-13), then search indexing — one after the
  other on this PC's GPU. Restartable: works already described for their current cover are skipped.
  Log: %USERPROFILE%\.venvs\transcribe-out\describe-batch\run-<date-time>.log
  Run by hand, or by the one-off Windows task "PEM describe batch" (registered 2026-11-13 for 14:00).
#>
$ErrorActionPreference = "Continue"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
$outDir = Join-Path $env:USERPROFILE ".venvs\transcribe-out\describe-batch"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir ("run-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".log")
$python = Join-Path $env:USERPROFILE ".venvs\transcribe\Scripts\python.exe"
$env:PYTHONIOENCODING = "utf-8"

"== $(Get-Date -Format s) describe batch" | Tee-Object -FilePath $log -Append
& $python scripts\transcribe\describe_batch.py --write 2>&1 | Tee-Object -FilePath $log -Append
"== $(Get-Date -Format s) search indexing" | Tee-Object -FilePath $log -Append
npm run embed:worker -- --drain 2>&1 | Tee-Object -FilePath $log -Append
"== $(Get-Date -Format s) done" | Tee-Object -FilePath $log -Append
