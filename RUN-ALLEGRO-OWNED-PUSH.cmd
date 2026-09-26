@echo off
setlocal EnableExtensions
title IZAKHONO - PUSH ALLEGRO TO OWNED INFRASTRUCTURE
cd /d "%~dp0"
set HOST=allegro.izakhonoafrica.co.za
if not "%~1"=="" set HOST=%~1

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\public-cutover\PUSH-ALLEGRO-OWNED.ps1" -AllegroHostname "%HOST%"
set RC=%ERRORLEVEL%
echo.
if "%RC%"=="10" (
  echo [ACTION REQUIRED] ALLEGRO DNS action report was written to Desktop.
  echo Existing external fallback remains untouched.
  exit /b 10
)
if not "%RC%"=="0" (
  echo [SAFE STOP] ALLEGRO owned cutover did not pass.
  echo Existing external fallback remains the safety path.
  exit /b %RC%
)
echo [COMPLETE] ALLEGRO owned public gates passed.
exit /b 0
