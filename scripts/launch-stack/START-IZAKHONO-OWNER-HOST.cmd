@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo       IZAKHONO OWNER HOST - WINDOWS BRIDGE
echo ================================================
echo.
echo This turns this authorised Windows computer into
echo the first IZAKHONO owner-controlled compute host.
echo It may restart Windows once, then continue after login.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows-owner-host.ps1" -AttemptRouterMapping
set "EXITCODE=%ERRORLEVEL%"
if "%EXITCODE%"=="0" goto done
if "%EXITCODE%"=="10" goto done
echo.
echo IZAKHONO setup stopped with exit code %EXITCODE%.
echo Keep this window open and send a screenshot if help is needed.
pause
:done
endlocal
