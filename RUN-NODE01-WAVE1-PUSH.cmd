@echo off
setlocal EnableExtensions
title IZAKHONO WAVE 1 - PUSH TO OWNED
cd /d "%~dp0"

set ALLEGRO=allegro.izakhonoafrica.co.za
set CHANCELLOR=chancellor.izakhonoafrica.co.za

if not "%~1"=="" set ALLEGRO=%~1
if not "%~2"=="" set CHANCELLOR=%~2

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\public-cutover\PUSH-WAVE1-OWNED.ps1" -AllegroHostname "%ALLEGRO%" -ChancellorHostname "%CHANCELLOR%"
set RC=%ERRORLEVEL%

echo.
if "%RC%"=="10" (
  echo [ACTION REQUIRED] DNS action report created on Desktop.
  echo External production remains live while DNS is updated.
  exit /b 10
)

if not "%RC%"=="0" (
  echo [SAFE STOP] Owned cutover did not pass.
  echo External production remains the safety path.
  exit /b %RC%
)

echo [COMPLETE] Wave 1 public owned gates passed.
exit /b 0
