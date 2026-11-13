<#
.SYNOPSIS
  Local jobs, one after the other (never in parallel: whisper large-v3 and the Ollama models
  do not fit together in 8 GB of GPU memory):
    1. voice notes -> transcripts added to the journal
       (scripts/transcribe/voice_batch.py --run --write; notes already done by the same engine are skipped)
    2. drain the embedding queue (local Ollama), so the new entries are found by search.
  Launched by the `pem-embed:` URL protocol from the Overview "Local jobs" card; safe to run by hand too.
  Takes no arguments on purpose: the protocol URL is ignored, so a link can't inject anything.
#>
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
$Host.UI.RawUI.WindowTitle = "PEM local jobs"

$failed = @()
$python = Join-Path $env:USERPROFILE ".venvs\transcribe\Scripts\python.exe"
if (Test-Path $python) {
  Write-Host "1/2  Voice notes -> transcripts" -ForegroundColor Cyan
  & $python scripts\transcribe\voice_batch.py --run --write
  if ($LASTEXITCODE -ne 0) { $failed += "transcription (exit $LASTEXITCODE)" }
} else {
  Write-Host "1/2  Skipped: no transcription venv at $python" -ForegroundColor Yellow
}

Write-Host "`n2/2  Search indexing" -ForegroundColor Cyan
npm run embed:worker -- --drain
if ($LASTEXITCODE -ne 0) { $failed += "indexing (exit $LASTEXITCODE)" }

if ($failed.Count -eq 0) {
  Write-Host "`nDone. This window closes in 10s." -ForegroundColor Green
  Start-Sleep -Seconds 10
  exit 0
}
Write-Host "`nFailed: $($failed -join ', '). Press Enter to close." -ForegroundColor Red
Read-Host | Out-Null
exit 1
