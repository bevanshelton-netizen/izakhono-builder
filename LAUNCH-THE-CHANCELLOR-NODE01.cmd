@echo off
setlocal EnableExtensions
title THE CHANCELLOR - IZAKHONO OWNED LAUNCH
cd /d "%~dp0"

set CHANCELLOR_HOST=%~1

echo ============================================================
echo THE CHANCELLOR - IZAKHONO OWNED LAUNCH ORCHESTRATOR
echo ============================================================
echo.

call RUN-THE-CHANCELLOR-NODE01.cmd
if errorlevel 1 (
  echo.
  echo [STOP] NODE01 activation did not complete.
  echo Existing public fallback remains unchanged.
  exit /b 1
)

echo.
call VERIFY-THE-CHANCELLOR-NODE01.cmd
if errorlevel 1 (
  echo.
  echo [STOP] NODE01 verification did not pass.
  echo Existing public fallback remains unchanged.
  exit /b 1
)

if "%CHANCELLOR_HOST%"=="" (
  echo.
  echo [PASS] The Chancellor is verified locally on NODE01.
  echo [HOLD] No owned public hostname was supplied, so EDGE was not staged.
  echo.
  echo To stage the public EDGE route later, run:
  echo   LAUNCH-THE-CHANCELLOR-NODE01.cmd chancellor.your-approved-domain
  exit /b 0
)

echo.
echo [EDGE DRY RUN] Staging %CHANCELLOR_HOST% without applying DNS/TLS cutover...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "infra\public-cutover\THE-CHANCELLOR-EDGE.ps1" -Hostname "%CHANCELLOR_HOST%"
if errorlevel 1 (
  echo.
  echo [STOP] EDGE dry-run did not pass.
  echo Existing public fallback remains unchanged.
  exit /b 1
)

echo.
echo ============================================================
echo [PASS] THE CHANCELLOR NODE01 OWNED LAUNCH PACKAGE IS READY.
echo Local runtime is healthy and the EDGE route is staged only.
echo No public DNS/TLS cutover was performed.
echo Vercel fallback remains active.
echo ============================================================
endlocal
