@echo off
setlocal EnableExtensions
title IZAKHONO NODE01 WAVE 1 - CONTINUE AFTER LOCAL PROOF
cd /d "%~dp0"

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set APPLY=
if /I "%~3"=="--apply-edge" set APPLY=-ApplyEdge

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\public-cutover\CONTINUE-WAVE1-AFTER-NODE01.ps1" -AllegroHostname "%~1" -ChancellorHostname "%~2" %APPLY%
set RC=%ERRORLEVEL%

echo.
if not "%RC%"=="0" (
  echo [SAFE STOP] Wave 1 continuation did not pass.
  echo Existing external production routes remain the safety path.
  exit /b %RC%
)

exit /b 0

:usage
echo Usage:
echo   RUN-NODE01-WAVE1-CONTINUE.cmd ^<allegro-owned-hostname^> ^<chancellor-owned-hostname^>
echo.
echo Dry-run stages EDGE config and validates local health. It does not activate Caddy.
echo After approved DNS points both hostnames to the owned EDGE, run:
echo   RUN-NODE01-WAVE1-CONTINUE.cmd ^<allegro-owned-hostname^> ^<chancellor-owned-hostname^> --apply-edge
exit /b 2
