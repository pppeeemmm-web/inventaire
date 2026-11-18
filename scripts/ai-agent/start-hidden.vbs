' Starts the PEM AI agent with no window (Pem 2026-11-18: « can I stop the PowerShell window? »).
' Run by the Task Scheduler task « PEM AI agent » (scripts/register-ai-agent.ps1). Working folder = the repo.
' Stop it from Task Manager (node.exe) or with: pwsh scripts/register-ai-agent.ps1 -Stop
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName))
shell.Run "node scripts\ai-agent\index.mjs", 0, False
