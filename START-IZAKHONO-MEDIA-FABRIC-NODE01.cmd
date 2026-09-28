@echo off
setlocal EnableExtensions
title IZAKHONO MEDIA RUNTIME FABRIC - NODE01

cd /d "%~dp0"
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

set BROKER_REPORT=%USERPROFILE%\Desktop\IZAKHONO-MEDIA-FABRIC-BROKER-REPORT.json
set VERIFY_REPORT=%USERPROFILE%\Desktop\IZAKHONO-MEDIA-FABRIC-VERIFY.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%BROKER_REPORT%"`) do set LINUX_BROKER_REPORT=%%I
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%VERIFY_REPORT%"`) do set LINUX_VERIFY_REPORT=%%I

echo ============================================================
echo IZAKHONO MEDIA RUNTIME FABRIC
echo Durable queue + leases + GPU workers + artifact storage
echo ============================================================

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-media-fabric/install-broker.sh" "%LINUX_BROKER_REPORT%"
if errorlevel 1 (
  echo [FAIL] Media Fabric broker installation/health gate failed.
  exit /b 1
)

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-media-fabric/install-worker.sh"
set WORKER_RC=%ERRORLEVEL%
if not "%WORKER_RC%"=="0" (
  echo [WARN] Media worker activation returned %WORKER_RC%.
)

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-media-fabric/verify-node.sh" "/etc/izakhono/apps/izakhono-media-fabric.env" "%LINUX_VERIFY_REPORT%"
if errorlevel 1 (
  echo [FAIL] Media Fabric verification failed.
  exit /b 1
)

powershell -NoProfile -Command "$r=Get-Content '%VERIFY_REPORT%' -Raw | ConvertFrom-Json; if($r.production_ready){exit 0}else{exit 2}"
set READY_RC=%ERRORLEVEL%

echo.
if "%READY_RC%"=="0" (
  echo ============================================================
  echo [PASS] MEDIA RUNTIME FABRIC IS PRODUCTION-READY ON THIS ROUTE.
  echo Replicated state and at least one healthy worker are proven.
  echo Evidence: %VERIFY_REPORT%
  echo ============================================================
  exit /b 0
)

echo ============================================================
echo [SAFE STOP] Media Fabric software is running, but production-HA
echo is NOT yet proven. Check replicated storage and healthy workers.
echo Evidence: %VERIFY_REPORT%
echo No false LIVE/HA claim is allowed.
echo ============================================================
exit /b 2