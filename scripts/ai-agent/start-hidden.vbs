' Starts the PEM AI agent for ONE pass with no window: it runs what is waiting on Bureau IA, then stops
' (Pem 2026-11-19 « on when I need it, shuts down when the job is done »).
' Started by: Bureau IA « Lancer sur ce PC » / « Faire maintenant » (the pem-ai: link), and Windows sign-in
' (Task Scheduler « PEM AI agent ») — both set up by scripts/register-ai-agent.ps1.
' Working folder = the app: this file is <app>\scripts\ai-agent\start-hidden.vbs, three levels up.
' Output goes to <app>\scripts\ai-agent\agent.log.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
shell.Run "cmd /c node scripts\ai-agent\index.mjs >> scripts\ai-agent\agent.log 2>&1", 0, False
