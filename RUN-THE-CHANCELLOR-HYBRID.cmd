@echo off
setlocal EnableExtensions
title THE CHANCELLOR - HYBRID INTERNAL + EXTERNAL
cd /d "%~dp0"

set CHANCELLOR_HOST=%~1
set FALLBACK=https://the-chancellor.vercel.app/
set REPORT=%USERPROFILE%\Desktop\THE-CHANCELLOR-HYBRID-STATUS.txt

echo ============================================================
echo THE CHANCELLOR - HYBRID DEPLOYMENT GATE
echo Primary: IZAKHONO NODE01
echo External resilience: %FALLBACK%
echo ============================================================
echo.

echo [1/4] Verifying external resilience route...
curl.exe -fsSI "%FALLBACK%" > "%TEMP%\chancellor-fallback.txt" 2>&1
if errorlevel 1 (
  echo [STOP] External fallback is not currently reachable.
  echo No owned cutover will be attempted.
  type "%TEMP%\chancellor-fallback.txt"
  exit /b 1
)
echo [PASS] External fallback is reachable.

echo.
echo [2/4] Activating and verifying owned NODE01 runtime...
if "%CHANCELLOR_HOST%"=="" (
  call LAUNCH-THE-CHANCELLOR-NODE01.cmd
) else (
  call LAUNCH-THE-CHANCELLOR-NODE01.cmd "%CHANCELLOR_HOST%"
)
if errorlevel 1 (
  echo [SAFE STOP] NODE01 activation/verification did not pass.
  echo External fallback remains unchanged.
  exit /b 1
)

echo.
echo [3/4] Re-verifying external resilience after NODE01 activation...
curl.exe -fsSI "%FALLBACK%" > "%TEMP%\chancellor-fallback-after.txt" 2>&1
if errorlevel 1 (
  echo [WARNING] NODE01 is healthy, but external resilience is no longer reachable.
  echo Do not promote HYBRID LIVE until resilience is restored.
  exit /b 1
)
echo [PASS] External fallback remains reachable.

echo.
echo [4/4] Writing hybrid evidence report...
(
  echo THE CHANCELLOR - HYBRID STATUS
  echo Generated: %DATE% %TIME%
  echo ============================================================
  echo.
  echo [OWNED NODE01 HEALTH]
  curl.exe -fsS http://127.0.0.1:3000/api/health 2^>^&1
  echo.
  echo.
  echo [OWNED NODE01 FEATURES]
  curl.exe -fsS http://127.0.0.1:3000/api/features 2^>^&1
  echo.
  echo.
  echo [OWNED NODE01 GO-LIVE]
  curl.exe -fsS http://127.0.0.1:3000/api/go-live 2^>^&1
  echo.
  echo.
  echo [EXTERNAL FALLBACK]
  curl.exe -fsSI "%FALLBACK%" 2^>^&1
  echo.
  if not "%CHANCELLOR_HOST%"=="" (
    echo [OWNED HOSTNAME STAGED]
    echo %CHANCELLOR_HOST%
    echo.
  )
  echo [STATUS]
  echo HYBRID_RUNTIME_VERIFIED_LOCALLY
  echo External route retained; owned public EDGE/TLS/DNS promotion remains separately gated.
) > "%REPORT%"

echo.
echo ============================================================
echo [PASS] HYBRID RUNTIME PROOF COMPLETE
echo Owned NODE01 is healthy.
echo External fallback is still reachable.
echo Report: %REPORT%
echo ============================================================
echo.
echo IMPORTANT:
echo This does not by itself prove OWNED LIVE VERIFIED.
echo Public EDGE/TLS/DNS and paid-traffic readiness still require their explicit gates.
endlocal
