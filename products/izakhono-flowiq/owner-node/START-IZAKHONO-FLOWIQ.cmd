@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo          IZAKHONO FLOWIQ - NODE 01
echo ================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-FLOWIQ.ps1"
if errorlevel 1 (
  echo.
  echo FLOWIQ NODE01 deployment did not complete.
  echo Keep this window open and use the generated report for diagnosis.
  pause
)
endlocal
