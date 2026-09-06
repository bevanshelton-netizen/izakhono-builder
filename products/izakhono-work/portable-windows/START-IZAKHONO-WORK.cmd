@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-WORK.ps1"
if errorlevel 1 (
  echo.
  echo IZAKHONO WORK could not start. Leave this window open and photograph it.
  pause
)
