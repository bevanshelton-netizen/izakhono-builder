@echo off
setlocal EnableExtensions
title THE CHANCELLOR - IZAKHONO NODE01
cd /d "%~dp0"

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)

set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
if "%LINUX_ROOT%"=="" (
  echo [STOP] Could not map IZAKHONO Builder into WSL.
  exit /b 1
)

echo ============================================================
echo THE CHANCELLOR - OWNED NODE01 ACTIVATION
echo Source: bevanshelton-netizen/the-chancellor
echo Runtime: IZAKHONO NODE01
echo Public cutover: NOT performed by this command
echo ============================================================
echo.

wsl.exe -d %DISTRO% -- bash "%LINUX_ROOT%/infra/launch-stack/deploy-the-chancellor.sh"
set RC=%ERRORLEVEL%

echo.
if "%RC%"=="2" (
  echo [ACTION REQUIRED ON THIS MACHINE]
  echo The host-only Chancellor environment file was created.
  echo Fill it locally with the required secrets, then run this file again.
  echo Never commit the filled environment file.
  exit /b 2
)
if not "%RC%"=="0" (
  echo [SAFE STOP] The Chancellor NODE01 activation did not pass.
  echo Existing public fallback routes were not changed.
  exit /b %RC%
)

echo.
echo [PASS] The Chancellor is healthy on owned NODE01.
echo Local health: http://127.0.0.1:3000/api/health
echo Local readiness: http://127.0.0.1:3000/api/go-live
echo.
echo NEXT:
echo Run VERIFY-THE-CHANCELLOR-NODE01.cmd
echo Public EDGE/TLS/DNS remains a separate verified gate.
endlocal
