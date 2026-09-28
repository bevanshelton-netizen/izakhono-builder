@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo          IZAKHONO MAIL + SIGN - NODE 01
echo ================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-MAIL-SIGN.ps1"
if errorlevel 1 (
 echo.
 echo MAIL/SIGN deployment did not complete.
 pause
)
endlocal
