@echo off
setlocal
cd /d "%~dp0"
echo.
echo ====================================================
echo       IZAKHONO DOCFLOW / CRM / SIGN - NODE 01
echo ====================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-DOCFLOW-CHAIN.ps1"
if errorlevel 1 (
 echo.
 echo Workflow-chain deployment did not complete.
 echo Keep this window open and use the generated Desktop report.
 pause
)
endlocal
