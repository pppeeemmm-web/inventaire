# dev.ps1 — start the PEM Hub dev server from the real app directory.
# Ensures .env.local exists; npm run dev refuses if port 3000 is taken and prints LAN URL (see scripts/run-dev.mjs).
# Stale server of yours on 3000: `npm run dev -- --force`.

$appRoot = Split-Path $PSScriptRoot -Parent
Set-Location $appRoot

if (-not (Test-Path "$appRoot\.env.local")) {
    Write-Error "No .env.local found at $appRoot — wrong directory?"
    exit 1
}

# Port 3000 + URLs: handled by npm run dev → scripts/run-dev.mjs
npm run dev
