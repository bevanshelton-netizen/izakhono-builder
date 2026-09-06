@echo off
setlocal EnableExtensions
title IZAKHONO WORK - ONE CLICK OWNER NODE

echo ============================================================
echo              IZAKHONO WORK - ONE CLICK OWNER NODE
echo ============================================================
echo.
echo This launcher installs only the owner-controlled local runtime
echo needed for IZAKHONO WORK, starts it, and runs OWNER-NODE-PROOF.
echo.

set "ROOT=%LOCALAPPDATA%\IzakhonoWork\portable-0.2.3"
set "SRC=https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/a78b3c4ec6f73f51b5cfe657486920edf0a30cbe/products/izakhono-work"
set "PYURL=https://www.python.org/ftp/python/3.13.7/python-3.13.7-embed-amd64.zip"

if not exist "%ROOT%" mkdir "%ROOT%"

echo [1/5] Preparing official portable Python...
if not exist "%ROOT%\python.exe" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%PYURL%' -OutFile '%ROOT%\python.zip'; Expand-Archive -Path '%ROOT%\python.zip' -DestinationPath '%ROOT%' -Force; Remove-Item '%ROOT%\python.zip' -Force"
  if errorlevel 1 goto :fail
)

echo [2/5] Downloading IZAKHONO WORK v0.2.3 source...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%SRC%/app.py' -OutFile '%ROOT%\app.py'; Invoke-WebRequest -Uri '%SRC%/builder_core.py' -OutFile '%ROOT%\builder_core.py'; Invoke-WebRequest -Uri '%SRC%/portable-windows/START-IZAKHONO-WORK.ps1' -OutFile '%ROOT%\START-IZAKHONO-WORK.ps1'; Invoke-WebRequest -Uri '%SRC%/portable-windows/VERIFY-OWNER-NODE.ps1' -OutFile '%ROOT%\VERIFY-OWNER-NODE.ps1'"
if errorlevel 1 goto :fail

echo [3/5] Verifying downloaded runtime...
"%ROOT%\python.exe" -c "import sys; sys.path.insert(0,r'%ROOT%'); import app,builder_core; assert app.WORK_VERSION=='0.2.3'; print('IZAKHONO_RUNTIME_VERIFY=PASS')"
if errorlevel 1 goto :fail

echo [4/5] Starting local owner node...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\START-IZAKHONO-WORK.ps1" -NoBrowser
if errorlevel 1 goto :fail

echo [5/5] Running real OWNER-NODE-PROOF build...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\VERIFY-OWNER-NODE.ps1"
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo IZAKHONO OWNER NODE BUILD PROOF PASSED
echo ============================================================
echo.
echo Opening IZAKHONO WORK...
start "" "http://127.0.0.1:9393"
echo.
echo You may close this black window.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo IZAKHONO ONE-CLICK SETUP STOPPED
echo ============================================================
echo.
echo Do not disable antivirus or security.
echo Leave this window open and photograph the last error shown above.
pause
exit /b 1
