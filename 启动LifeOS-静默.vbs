Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "Start-LifeOS.ps1")

If Not fso.FileExists(scriptPath) Then
  MsgBox "Cannot find Start-LifeOS.ps1: " & scriptPath, vbExclamation, "Life OS"
  WScript.Quit 1
End If

command = "powershell -NoProfile -ExecutionPolicy Bypass -File " & Quote(scriptPath)
shell.Run command, 0, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
