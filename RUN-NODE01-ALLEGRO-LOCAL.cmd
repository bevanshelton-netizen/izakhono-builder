@echo off
setlocal EnableExtensions
title IZAKHONO NODE01 - ALLEGRO LOCAL OWNED PROOF
cd /d "%~dp0"

echo ============================================================
echo IZAKHONO NODE01 - ALLEGRO VIBEZ LOCAL OWNED PROOF
echo ALLEGRO ONLY - NO DNS / EDGE / PUBLIC TRAFFIC CHANGES
echo ============================================================

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)

set DISTRO=Ubuntu
set REPORT=%USERPROFILE%\Desktop\IZAKHONO-NODE01-ALLEGRO-REPORT.json

echo [1/4] Checking NODE01 readiness...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9191/readyz >nul 2>&1
if errorlevel 1 (
  echo [RECOVER] NODE01 is not ready. Activating owned Command Centre and deployment stack...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACTIVATE-IZAKHONO-COMMAND-CENTRE.ps1" -Distro "%DISTRO%"
  if errorlevel 1 (
    echo [SAFE STOP] NODE01 activation failed. Public traffic was not changed.
    exit /b 1
  )
)

echo [2/4] Verifying NODE + CONTROL...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9191/readyz
if errorlevel 1 exit /b 1
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9292/healthz
if errorlevel 1 exit /b 1

echo [3/4] Running fixed Allegro-only owned proof bridge...
wsl.exe -d %DISTRO% -u root -- /opt/izakhono/bin/run-allegro-local-proof
set RC=%ERRORLEVEL%

echo [4/4] Copying evidence...
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I
if not "%LINUX_REPORT%"=="" (
  wsl.exe -d %DISTRO% -u root -- bash -lc "cp /opt/izakhono/evidence/IZAKHONO-NODE01-ALLEGRO-REPORT.json '%LINUX_REPORT%' && chown $(stat -c %%u /mnt/c/Users 2>/dev/null || echo 0):$(stat -c %%g /mnt/c/Users 2>/dev/null || echo 0) '%LINUX_REPORT%' 2>/dev/null || true"
)

if exist "%REPORT%" type "%REPORT%"
echo.
if not "%RC%"=="0" (
  echo [SAFE STOP] Allegro local owned proof did not pass.
  echo No DNS, EDGE or public traffic change was made.
  exit /b %RC%
)

echo ============================================================
echo [PASS] ALLEGRO LOCAL OWNED PROOF PASSED
echo Next gate: ALLEGRO EDGE -> DNS -> TLS -> public HTTPS.
echo ============================================================
exit /b 0
