@echo off
REM Starts the Media Remote server
REM Uses "node" directly to avoid PowerShell execution policy issues with npm.ps1
cd /d "%~dp0server"
node server.js
