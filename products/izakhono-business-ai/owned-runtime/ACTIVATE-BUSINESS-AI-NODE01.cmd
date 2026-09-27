@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACTIVATE-BUSINESS-AI-NODE01.ps1"
if errorlevel 1 (
  echo.
  echo IZAKHONO BUSINESS AI activation FAILED.
  exit /b 1
)
echo.
echo IZAKHONO BUSINESS AI local activation PASSED.
