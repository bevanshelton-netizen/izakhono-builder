@echo off
setlocal
title IZAKHONO VENTURE FACTORY - OWNER DEPLOY
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-VENTURE-FACTORY-NODE01.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo Venture Factory owner deployment stopped with code %RC%.
  exit /b %RC%
)
echo Venture Factory owner deployment sequence completed.
endlocal
