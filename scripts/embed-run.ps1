<#
.SYNOPSIS
  Drain the embedding queue once (local Ollama). Launched by the `pem-embed:` URL
  protocol from the Overview "Run indexing" button; safe to run by hand too.
  Takes no arguments on purpose: the protocol URL is ignored, so a link can't inject anything.
#>
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
$Host.UI.RawUI.WindowTitle = "PEM embed worker"

npm run embed:worker -- --drain
$code = $LASTEXITCODE

if ($code -eq 0) {
  Write-Host "`nDone. This window closes in 10s." -ForegroundColor Green
  Start-Sleep -Seconds 10
} else {
  Write-Host "`nEmbed worker failed (exit $code). Press Enter to close." -ForegroundColor Red
  Read-Host | Out-Null
}
exit $code
