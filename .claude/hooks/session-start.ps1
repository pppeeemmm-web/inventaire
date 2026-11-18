# SessionStart hook (owner GO 2026-11-18): every session opens with the git state and the docs read order,
# so "start from git status + README" no longer depends on anyone remembering. Read only, no network (no fetch).
# stdout goes into the session's context; keep it short.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))

Write-Output '## Session start (auto: .claude/hooks/session-start.ps1)'
Write-Output '```'
& git.exe status --short --branch 2>$null | Select-Object -First 25
Write-Output '```'
$ahead = @(& git.exe log --oneline origin/main..HEAD 2>$null)
if ($ahead.Count) { Write-Output "Not on origin/main yet ($($ahead.Count) commit(s), as of last fetch):"; $ahead | Select-Object -First 10 }
else { Write-Output 'HEAD == origin/main (as of last fetch).' }
$readOrder = (Select-String -Path docs/README.md -Pattern '^\*\*Read order' -Encoding utf8 | Select-Object -First 1).Line
if ($readOrder) { Write-Output "docs/README.md: $readOrder" }
exit 0
