@echo off
setlocal
cd /d "%~dp0"
if exist "IZAKHONO-SEND.exe" (
  start "" "IZAKHONO-SEND.exe"
) else if exist "..\..\dist\IZAKHONO-SEND.exe" (
  start "" "..\..\dist\IZAKHONO-SEND.exe"
) else (
  echo IZAKHONO-SEND.exe was not found in this folder.
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8787"
endlocal
