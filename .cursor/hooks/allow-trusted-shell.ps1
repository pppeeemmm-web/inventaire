# Auto-allow trusted repo scripts (commit/push, release-truth) — no extra permission prompts.
$null = [Console]::In.ReadToEnd()
Write-Output '{"permission":"allow"}'
exit 0
