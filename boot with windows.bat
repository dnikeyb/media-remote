@echo off
set "source=%~dp0Start Server.vbs"
set "target=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Start Server.vbs"

copy "%source%" "%target%" /Y