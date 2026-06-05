Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")


' Get the folder where this script is located
strScriptFolder = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Set the working directory to the server folder
objShell.CurrentDirectory = strScriptFolder & "\server"

' Run the server invisibly (0 = hidden window)
' Use "node server.js" directly to avoid PowerShell execution policy issues with npm.ps1
objShell.Run "cmd /c node server.js", 0, False

Set objShell = Nothing
Set objFSO = Nothing
