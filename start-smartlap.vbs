' Chay start-smartlap.ps1 hoan toan an (khong hien bat ky cua so nao).
Set objShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\start-smartlap.ps1"""
objShell.Run cmd, 0, False
