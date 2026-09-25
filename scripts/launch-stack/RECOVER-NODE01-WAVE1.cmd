@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo   RECOVER NODE01 + RUN WAVE 1 OWNED PROOF
echo ================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RECOVER-NODE01-WAVE1.ps1"
set "EXITCODE=%ERRORLEVEL%"
if "%EXITCODE%"=="0" goto done
echo.
echo IZAKHONO safe-stopped with exit code %EXITCODE%.
echo No public cutover was performed.
pause
:done
endlocal
