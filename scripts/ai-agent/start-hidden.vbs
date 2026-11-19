' Starts the PEM AI agent with no window (Pem 2026-11-18: « can I stop the PowerShell window? »).
' Run by the Task Scheduler task « PEM AI agent » (scripts/register-ai-agent.ps1).
' Working folder = the app (this file is in <app>\scripts\ai-agent: three levels up from the file itself — two levels
' landed in <app>\scripts, where node found no script and exited at once: the agent never ran from here, fixed 2026-11-19).
' If the agent stops for any reason it is started again 30 s later. Output goes to <app>\scripts\ai-agent\agent.log.
' Stop it with: pwsh scripts/register-ai-agent.ps1 -Stop (ends wscript first, then node).
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
app = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
shell.CurrentDirectory = app
Do
  shell.Run "cmd /c node scripts\ai-agent\index.mjs >> scripts\ai-agent\agent.log 2>&1", 0, True
  WScript.Sleep 30000
Loop
