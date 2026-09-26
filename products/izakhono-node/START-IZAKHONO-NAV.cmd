@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-NAV.ps1" %*
set rc=%ERRORLEVEL%
if not "%rc%"=="0" pause
exit /b %rc%
