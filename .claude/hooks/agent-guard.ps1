# Blocks subagents that would run on the main (Opus) model without need.
# Allowed: scout (Haiku), builder (Sonnet), flow-reviewer (main model, deliberate).
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$t = $in.tool_input.subagent_type
if ($t -in @('scout', 'builder', 'flow-reviewer')) { exit 0 }
[Console]::Error.WriteLine("Agent guard: '$t' inherits the main model (token burn). Use scout (read-only search), builder (mechanical edit), or flow-reviewer. Max 3 subagents at once; long work = new session or cloud.")
exit 2
