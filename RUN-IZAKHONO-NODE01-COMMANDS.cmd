@echo off
setlocal
cd /d "%~dp0"
echo.
echo IZAKHONO NODE01 COMMAND CENTRE
echo Redirecting to the current owned CONTROL -> NODE activation path...
echo.
call "%~dp0ACTIVATE-IZAKHONO-COMMAND-CENTRE.cmd"
exit /b %ERRORLEVEL%
