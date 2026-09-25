@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%START-IZAKHONO-SUPER-AI-NODE01.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo IZAKHONO SUPER AI startup failed with code %RC%.
  exit /b %RC%
)
echo IZAKHONO SUPER AI startup completed.
endlocal
