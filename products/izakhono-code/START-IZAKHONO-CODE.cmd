@echo off
setlocal
cd /d "%~dp0"
title IZAKHONO CODE Complete Alpha
echo Starting IZAKHONO CODE on this owner laptop...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\START-IZAKHONO-CODE.ps1"
set "IZAKHONO_EXIT=%ERRORLEVEL%"
if not "%IZAKHONO_EXIT%"=="0" (
  echo.
  echo IZAKHONO CODE did not start. Read the BLOCKED message above.
  echo.
)
echo Press any key to close this window.
pause >nul
exit /b %IZAKHONO_EXIT%
