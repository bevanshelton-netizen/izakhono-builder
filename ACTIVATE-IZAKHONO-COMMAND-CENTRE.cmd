@echo off
setlocal
cd /d "%~dp0"
title IZAKHONO COMMAND CENTRE - CEO ACTIVATION
echo.
echo ============================================================
echo     IZAKHONO COMMAND CENTRE - OWNED INFRASTRUCTURE
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACTIVATE-IZAKHONO-COMMAND-CENTRE.ps1"
if errorlevel 1 (
  echo.
  echo Activation did not complete. Keep this window open.
  pause
  exit /b 1
)
echo.
echo Activation completed.
pause
endlocal
