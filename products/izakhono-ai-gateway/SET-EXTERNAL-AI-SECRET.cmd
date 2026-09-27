@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%SET-EXTERNAL-AI-SECRET.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo External AI credential setup failed with code %RC%.
  pause
)
exit /b %RC%
