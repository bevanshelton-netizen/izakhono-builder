@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFY-ORACLE-A1-WORKER.ps1"
exit /b %ERRORLEVEL%
