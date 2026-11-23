# One command: the app on the throwaway copy (Docker), with this checkout's code — committed AND uncommitted.
# Run from the main checkout:  & .\scripts\stress\up.ps1          (then open http://127.0.0.1:3077)
# Stop:                        & .\scripts\stress\up.ps1 -Down    (data kept; close the two server windows)
# Fresh fake data:             & .\scripts\stress\up.ps1 -Seed
#
# What it does (README.md, « Start »): starts Docker Desktop if needed; brings the worktree
# ..\app-worktrees\stress-live to this checkout's commit and lays this checkout's uncommitted changes over it
# (the previous ones are taken back first, never a reset); starts the local database; opens two windows —
# the fake image storage and the app (next dev on :3077, the stress keys only). Nothing reaches the real site:
# the worktree has no .env.local and run-stress-dev.mjs refuses any production value.
# -Prepare: steps 1–3 only (Docker, worktree, database), no windows — used by scripts/stress/e2e.mjs (npm run test:e2e:stress).
param([switch]$Down, [switch]$Seed, [switch]$Prepare)
$ErrorActionPreference = 'Stop'
# git output (the draft patch below) is UTF-8: read it as such, or « » — and accents are mangled and the patch does not apply.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$root = (git rev-parse --show-toplevel).Trim()
$wt = Join-Path (Split-Path $root -Parent) 'app-worktrees\stress-live'
$sbArgs = @('-y', 'supabase@3')
$exclude = 'studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,realtime'

$pidFile = Join-Path $wt 'scripts\stress\dump\windows.pid'

if ($Down) {
  if (Test-Path $pidFile) {
    foreach ($id in Get-Content $pidFile) { taskkill /PID $id /T /F *> $null }
    Remove-Item $pidFile
  }
  if (Test-Path $wt) { Push-Location $wt; try { npx @sbArgs stop --workdir scripts/stress } finally { Pop-Location } }
  Write-Host '[stress] app and storage windows closed, database stopped (data kept). Quit Docker Desktop if done.'
  return
}

# 1. Docker
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $exe = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
  if (-not (Test-Path $exe)) { $exe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe' }
  if (-not (Test-Path $exe)) { throw 'Docker Desktop not found: start it by hand, then run this again.' }
  Write-Host '[stress] starting Docker Desktop…'
  Start-Process $exe
  $deadline = (Get-Date).AddSeconds(180)
  do { Start-Sleep -Seconds 3; docker info *> $null } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
  if ($LASTEXITCODE -ne 0) { throw 'Docker did not answer within 3 minutes.' }
}

# 2. The worktree at this checkout's commit, with its uncommitted changes laid over
$head = (git -C $root rev-parse HEAD).Trim()
if (-not (Test-Path $wt)) {
  git -C $root worktree add --detach $wt $head
  if ($LASTEXITCODE -ne 0) { throw 'git worktree add failed' }
  cmd /c mklink /J "$wt\node_modules" "$root\node_modules" | Out-Null
}
if (Test-Path (Join-Path $wt '.env.local')) { throw "Refusing: $wt has a .env.local (production keys)." }
$dump = Join-Path $wt 'scripts\stress\dump'
New-Item -ItemType Directory -Force $dump | Out-Null
$lastPatch = Join-Path $dump 'draft.patch'
if (Test-Path $lastPatch) {
  # Take back the previous draft before moving (fails loudly rather than discard anything).
  if ((Get-Item $lastPatch).Length -gt 0) {
    git -C $wt apply -R --whitespace=nowarn $lastPatch
    if ($LASTEXITCODE -ne 0) { throw "Could not take back the previous draft in $wt — look at it by hand (git -C `"$wt`" status)." }
  }
  Remove-Item $lastPatch
}
$dirty = git -C $wt status --porcelain --untracked-files=no
if ($dirty) { throw "$wt has changes this script did not make — look at it by hand (git -C `"$wt`" status)." }
git -C $wt checkout --quiet --detach $head
if ($LASTEXITCODE -ne 0) { throw 'git checkout failed in the stress worktree' }

# Uncommitted changes of this checkout: tracked diff + new files, as one patch.
$patch = [System.Collections.Generic.List[string]]::new()
$tracked = git -C $root diff HEAD --binary
if ($tracked) { $patch.Add(($tracked -join "`n")) }
foreach ($f in (git -C $root ls-files --others --exclude-standard)) {
  $nf = git -C $root diff --no-index --binary -- /dev/null $f
  if ($nf) { $patch.Add(($nf -join "`n")) }
}
if ($patch.Count -gt 0) {
  $text = ($patch -join "`n") + "`n"
  [System.IO.File]::WriteAllText($lastPatch, $text, [System.Text.UTF8Encoding]::new($false))
  git -C $wt apply --whitespace=nowarn $lastPatch
  if ($LASTEXITCODE -ne 0) { Remove-Item $lastPatch; throw 'The uncommitted changes did not apply to the stress worktree.' }
  Write-Host "[stress] uncommitted changes laid over $($head.Substring(0, 7))"
} else {
  New-Item -ItemType File -Force $lastPatch | Out-Null
  Write-Host "[stress] code = $($head.Substring(0, 7)), no uncommitted changes"
}

# 3. The database (data kept between runs)
Push-Location $wt
try {
  npx @sbArgs start --workdir scripts/stress -x $exclude
  if ($LASTEXITCODE -ne 0) { throw 'supabase start failed' }
  if ($Seed) { node scripts/stress/seed.mjs; if ($LASTEXITCODE -ne 0) { throw 'seed failed' } }
} finally { Pop-Location }

if ($Prepare) { return }

# 4. Fake image storage + the app, each in its own window
# The storage stub makes its self-signed certificate with openssl once: Git for Windows ships one (not on PowerShell's PATH).
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
  $gitUsrBin = Join-Path (Split-Path (Split-Path (Get-Command git).Source -Parent) -Parent) 'usr\bin'
  if (Test-Path (Join-Path $gitUsrBin 'openssl.exe')) { $env:PATH = "$env:PATH;$gitUsrBin" }
}
$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }
$r2 = Start-Process $shell -PassThru -WorkingDirectory $wt -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='stress r2'; node scripts/stress/r2-stub.mjs"
Start-Sleep -Seconds 2
$app = Start-Process $shell -PassThru -WorkingDirectory $wt -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='stress app'; node scripts/stress/run-stress-dev.mjs"
Set-Content $pidFile @($r2.Id, $app.Id)

Write-Host ''
Write-Host '[stress] app starting on http://127.0.0.1:3077 (first page ~30 s)'
Write-Host '[stress] sign in: pem.stress@example.test / stress-admin-2026  (team: team.stress@example.test / stress-team-2026)'
Write-Host '[stress] stop: & .\scripts\stress\up.ps1 -Down'
