@echo off
setlocal EnableExtensions
title IZAKHONO WAVE 1 - OWNED RUNTIME CERTIFICATION
cd /d "%~dp0"

set "SCRIPT=%~dp0infra\runtime-fabric\CERTIFY-WAVE1-OWNED.ps1"
if not exist "%SCRIPT%" (
  echo [STOP] Missing certification script: %SCRIPT%
  exit /b 2
)

if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -PublicIPv4 "%~1"
)
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [SAFE STOP] Owned certification did not pass.
  echo Existing verified external production remains authoritative.
  exit /b %RC%
)

echo [PASS] Wave 1 owned certification completed.
exit /b 0
