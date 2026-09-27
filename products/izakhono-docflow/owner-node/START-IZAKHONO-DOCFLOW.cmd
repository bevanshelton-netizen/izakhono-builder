@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo          IZAKHONO DOCFLOW - NODE 01
echo ================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-DOCFLOW.ps1"
if errorlevel 1 (
  echo.
  echo DOCFLOW NODE01 deployment did not complete.
  echo Keep this window open and use the generated report for diagnosis.
  pause
)
endlocal
