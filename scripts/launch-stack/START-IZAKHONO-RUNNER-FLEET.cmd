@echo off
setlocal
cd /d "%~dp0"
echo.
echo =================================================
echo      IZAKHONO NODE01 - RUNNER FLEET ACTIVATE
echo =================================================
echo.
echo This connects NODE01 to all queued IZAKHONO
echo owner-host deployment workflows.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0enable-actions-runner-fleet.ps1"
set "EXITCODE=%ERRORLEVEL%"
if "%EXITCODE%"=="0" goto done
echo.
echo Runner-fleet activation stopped with exit code %EXITCODE%.
echo Keep this window open if assistance is needed.
pause
:done
endlocal
