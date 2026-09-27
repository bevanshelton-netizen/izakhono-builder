@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%VERIFY-EXTERNAL-AI.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo IZAKHONO SUPER AI external verification failed with code %RC%.
  pause
)
exit /b %RC%
