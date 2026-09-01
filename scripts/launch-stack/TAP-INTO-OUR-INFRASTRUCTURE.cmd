@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo   TAP INTO OUR OWN IZAKHONO INFRASTRUCTURE
echo ================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tap-into-our-infrastructure.ps1"
set "EXITCODE=%ERRORLEVEL%"
if "%EXITCODE%"=="0" goto done
echo.
echo IZAKHONO stopped with exit code %EXITCODE%.
echo Keep this window open if you need to share the error.
pause
:done
endlocal
