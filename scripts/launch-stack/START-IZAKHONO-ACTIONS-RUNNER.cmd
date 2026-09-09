@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo       IZAKHONO ACTIONS RUNNER - NODE 01
echo ================================================
echo.
echo This activates NODE 01 for queued IZAKHONO
echo production workflows. The short-lived token is
echo requested securely and is not saved by this launcher.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0enable-actions-runner.ps1"
if errorlevel 1 (
  echo.
  echo Runner activation did not complete.
  echo Keep this window open and send a screenshot if help is needed.
  pause
)
endlocal
