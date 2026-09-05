@echo off
setlocal
title IZAKHONO WORK - ONE CLICK START
color 0A

echo ============================================================
echo              IZAKHONO WORK - ONE CLICK START
echo ============================================================
echo.
echo This starter works even if Windows opens it from Downloads.
echo It does NOT rely on companion files in a ZIP folder.
echo.
echo Preparing local installer...
echo.

set "WORKDIR=%TEMP%\IZAKHONO-WORK-ONECLICK"
if not exist "%WORKDIR%" mkdir "%WORKDIR%"
cd /d "%WORKDIR%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/f37909801e27285ae2b6f3bc33da953e636c1ffc/products/izakhono-work/app.py' -OutFile '.\app.py';" ^
  "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/f37909801e27285ae2b6f3bc33da953e636c1ffc/products/izakhono-work/install-windows-native.ps1' -OutFile '.\install-windows-native.ps1';"

if errorlevel 1 (
  echo.
  echo ============================================================
  echo DOWNLOAD FAILED
  echo ============================================================
  echo Check that this laptop is connected to the internet.
  echo Then run this file again.
  echo.
  pause
  exit /b 20
)

echo Files ready. Starting IZAKHONO WORK setup...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\install-windows-native.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo ============================================================
  echo IZAKHONO WORK DID NOT START - CODE %RC%
  echo ============================================================
  echo Take a photo of THIS black window and send it to ChatGPT.
  echo.
  pause
  exit /b %RC%
)

echo.
echo ============================================================
echo IZAKHONO WORK IS READY
echo ============================================================
echo Opening the owner workspace now...
echo.

start "" "http://127.0.0.1:9393"
timeout /t 2 /nobreak >nul
exit /b 0
