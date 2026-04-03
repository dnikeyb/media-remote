Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

' Get the folder where this script is located
strScriptFolder = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Set the working directory to the server folder
objShell.CurrentDirectory = strScriptFolder & "\server"

' Run the server invisibly (0 = hidden window)
objShell.Run "cmd /c npm start", 0, False

Set objShell = Nothing
Set objFSO = Nothing
