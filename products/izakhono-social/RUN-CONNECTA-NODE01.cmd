@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CONNECTA - IZAKHONO NODE01 LOCAL OWNED PROOF
cd /d "%~dp0\..\.."

echo ============================================================
echo CONNECTA - IZAKHONO NODE01
echo OWNED COMPOSE DEPLOYMENT + FULL STACK HEALTH PROOF
echo NO DNS OR PUBLIC CUTOVER IS PERFORMED BY THIS LAUNCHER
echo ============================================================

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)
where git.exe >nul 2>&1 || (
  echo [STOP] Git is not available.
  exit /b 1
)

for /f "usebackq delims=" %%I in (`git rev-parse HEAD`) do set REF=%%I
if "%REF%"=="" (
  echo [STOP] Could not determine immutable repository commit.
  exit /b 1
)

set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
if "%LINUX_ROOT%"=="" (
  echo [STOP] Could not map repository path into WSL.
  exit /b 1
)

set REPORT=%USERPROFILE%\Desktop\CONNECTA-NODE01-REPORT.txt
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I

echo [1/4] Checking NODE01 guardian...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:9191/readyz
if errorlevel 1 (
  echo.
  echo [STOP] NODE01 guardian is not ready. No public route was changed.
  exit /b 1
)

echo.
echo [2/4] Checking CONNECTA secret environment...
wsl.exe -d %DISTRO% -u root -- test -f /etc/izakhono/apps/connecta.env
if errorlevel 1 (
  echo [STOP] Missing /etc/izakhono/apps/connecta.env
  echo Required keys: CONNECTA_DB_PASSWORD and CONNECTA_OWNER_KEY
  exit /b 1
)

echo.
echo [3/4] Deploying immutable CONNECTA stack at %REF%...
wsl.exe -d %DISTRO% -u root -- bash -lc "PROFILE='%LINUX_ROOT%/products/izakhono-node/profiles/connecta.production.json'; JOB=\$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d["ref"]=sys.argv[2]; print(json.dumps(d))' \"\$PROFILE\" '%REF%'); bash '%LINUX_ROOT%/products/izakhono-node/deploy.sh' \"\$JOB\" 2>&1 | tee '%LINUX_REPORT%'"
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo [SAFE STOP] CONNECTA did not pass local owned deployment proof.
  echo Public DNS and external fallback remain untouched.
  exit /b %RC%
)

echo.
echo [4/4] Verifying full web + engine + database health...
wsl.exe -d %DISTRO% -u root -- curl -fsS http://127.0.0.1:3080/health
if errorlevel 1 (
  echo [STOP] CONNECTA full-stack health failed after deployment.
  exit /b 1
)

echo.
echo ============================================================
echo [PASS] CONNECTA BUILT / VERIFIED LOCALLY on NODE01.
echo Public status is NOT claimed by this result.
echo Next gate: EDGE/TLS + DNS + independent HTTPS 200 verification.
echo Report: %REPORT%
echo ============================================================
endlocal
