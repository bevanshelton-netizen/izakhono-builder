@echo off
setlocal EnableExtensions
title IZAKHONO NODE01 CUTOVER WAVE 1 - LOCAL PROOF
cd /d "%~dp0"

echo ============================================================
echo IZAKHONO NODE01 CUTOVER WAVE 1
echo ALLEGRO VIBEZ + THE CHANCELLOR
echo LOCAL OWNED PROOF ONLY - NO DNS CHANGES
echo ============================================================

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)

set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
if "%LINUX_ROOT%"=="" (
  echo [STOP] Could not map repository path into WSL.
  exit /b 1
)

set REPORT=%USERPROFILE%\Desktop\IZAKHONO-NODE01-WAVE1-REPORT.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I

echo [1/4] Checking NODE01 readiness...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9191/readyz
if errorlevel 1 (
  echo.
  echo [RECOVER] NODE01 is not ready. Running owned recovery path...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-stack\RECOVER-NODE01-WAVE1.ps1" -Distro "%DISTRO%"
  if errorlevel 1 (
    echo.
    echo [SAFE STOP] NODE01 recovery/proof did not pass.
    echo Existing external production remains untouched.
    exit /b 1
  )
  echo.
  echo [RECOVERED] NODE01 recovery path completed.
)

echo [2/4] Rechecking NODE01 readiness...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9191/readyz
if errorlevel 1 (
  echo.
  echo [SAFE STOP] NODE01 is still not ready after recovery.
  echo Existing external production remains untouched.
  exit /b 1
)
echo.

echo [3/4] Running immutable local deployment wave...
wsl.exe -d %DISTRO% -u root -- python3 "%LINUX_ROOT%/products/izakhono-node/wave1_deploy.py" --report "%LINUX_REPORT%"
set RC=%ERRORLEVEL%

echo.
echo [4/4] Report:
if exist "%REPORT%" type "%REPORT%"

echo.
if not "%RC%"=="0" (
  echo [SAFE STOP] Wave 1 did not pass local owned verification.
  echo External production routes were not changed.
  exit /b %RC%
)

echo ============================================================
echo [PASS] NODE01 local owned deployment proof passed.
echo NO PUBLIC CUTOVER HAS BEEN CLAIMED OR PERFORMED.
echo Next gate: assign real owned hostnames, stage EDGE/TLS, verify DNS.
echo ============================================================
endlocal
