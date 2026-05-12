# dev.ps1 — start the PEM Hub dev server from the real app directory.
# Kills anything on port 3000 first, then prints the LAN address for phone testing.

$appRoot = Split-Path $PSScriptRoot -Parent
Set-Location $appRoot

if (-not (Test-Path "$appRoot\.env.local")) {
    Write-Error "No .env.local found at $appRoot — wrong directory?"
    exit 1
}

# Kill anything holding port 3000
$pids = (netstat -ano | Select-String ":3000 " | Select-String "LISTENING" |
    ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique)
foreach ($p in $pids) {
    if ($p -match '^\d+$') {
        Write-Host "[dev] Killing PID $p on port 3000"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}

# Print LAN IP for phone
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.)' -and $_.PrefixOrigin -in 'Dhcp','Manual' } |
    Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "  Local : http://localhost:3000"
if ($ip) { Write-Host "  Phone : http://${ip}:3000" }
Write-Host ""

npm run dev
