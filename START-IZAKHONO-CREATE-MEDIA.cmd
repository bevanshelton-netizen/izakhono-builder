@echo off
setlocal EnableExtensions
title IZAKHONO CREATE MEDIA - NODE01

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

set REPORT=%USERPROFILE%\Desktop\IZAKHONO-CREATE-MEDIA-REPORT.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I

echo ============================================================
echo IZAKHONO CREATE - OWNED MEDIA RUNTIME
echo NODE01 / WSL / LOCAL GPU
echo ============================================================
echo.

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-media-runtime/install-node01.sh" "%LINUX_REPORT%"
set RC=%ERRORLEVEL%

echo.
if exist "%REPORT%" (
  echo Evidence report:
  type "%REPORT%"
  echo.
)

if "%RC%"=="0" (
  echo ============================================================
  echo [PASS] IZAKHONO CREATE media runtime is healthy on NODE01.
  echo Local health: http://127.0.0.1:9696/healthz
  echo ============================================================
  exit /b 0
)

if "%RC%"=="2" (
  echo ============================================================
  echo [ACTION NEEDED] Software installed, but GPU/model readiness
  echo is not yet proven. Read the Desktop report for the exact
  echo next action. No false LIVE status has been claimed.
  echo ============================================================
  exit /b 2
)

echo [FAIL] NODE01 media activation stopped with exit code %RC%.
exit /b %RC%
