@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo             IZAKHONO NODE - NODE 01
echo ================================================
echo.
echo Activating our owner-controlled execution node.
echo GitHub Actions runner registration is NOT required.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-NODE.ps1"
if errorlevel 1 (
  echo.
  echo IZAKHONO NODE activation did not complete.
  echo Keep this window open and send a screenshot if help is needed.
  pause
)
endlocal
