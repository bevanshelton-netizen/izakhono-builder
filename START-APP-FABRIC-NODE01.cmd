@echo off
setlocal EnableExtensions
title IZAKHONO APP FABRIC - NODE01 ACTIVATION
cd /d "%~dp0"

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)

set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
if "%LINUX_ROOT%"=="" (
  echo [STOP] Could not map the repository into WSL.
  exit /b 1
)

set REPORT=%USERPROFILE%\Desktop\IZAKHONO-APP-FABRIC-NODE01-REPORT.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I

echo ============================================================
echo IZAKHONO APP FABRIC - OWNED INTERNAL ACTIVATION
echo CRM + APP FABRIC GATEWAY
echo NO PUBLIC DNS OR EDGE CHANGE
echo ============================================================

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/infra/app-fabric-runtime/activate-node01.sh" "%LINUX_REPORT%"
set RC=%ERRORLEVEL%

echo.
if exist "%REPORT%" (
  echo Evidence report:
  type "%REPORT%"
)

if not "%RC%"=="0" (
  echo.
  echo [SAFE STOP] APP FABRIC internal activation did not pass.
  echo Existing public platform routes were not changed.
  exit /b %RC%
)

echo.
echo [PASS] APP FABRIC is healthy internally on the owned host.
echo [HOLD] Public activation is a separate DNS / EDGE / allowed-origin gate.
endlocal
