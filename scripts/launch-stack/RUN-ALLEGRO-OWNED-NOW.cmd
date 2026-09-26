@echo off
setlocal EnableExtensions
title ALLEGRO VIBEZ - IZAKHONO OWNED DEPLOYMENT
cd /d "%~dp0"

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo Requesting Administrator rights...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo.
echo =====================================================
echo    ALLEGRO VIBEZ - OWNED NODE01 DEPLOYMENT
echo =====================================================
echo.
echo Authority: IZAKHONO CODE ^> NODE01 ^> EDGE/TLS ^> DNS
echo GitHub run: 36225079305
echo Public host: https://allegro.izakhonoafrica.co.za
echo.

call "%~dp0RECOVER-NODE01-WAVE1.cmd"
if errorlevel 1 (
  echo.
  echo [SAFE STOP] NODE01 recovery/local proof did not pass.
  echo ALLEGRO production was not declared live.
  pause
  exit /b 1
)

where gh.exe >nul 2>&1
if errorlevel 1 (
  echo.
  echo [SAFE STOP] GitHub CLI is unavailable after recovery.
  echo The runner may still claim the queued deployment automatically.
  echo Check Desktop recovery evidence before proceeding.
  pause
  exit /b 2
)

gh.exe auth status --hostname github.com >nul 2>&1
if errorlevel 1 (
  echo.
  echo [SAFE STOP] GitHub CLI is not authenticated.
  echo Re-run START-IZAKHONO-RUNNER-FLEET.cmd from this folder.
  pause
  exit /b 3
)

echo.
echo === Watching queued ALLEGRO production cutover ===
gh.exe run watch 36225079305 --repo bevanshelton-netizen/allegro-vibez --exit-status
set "RUN_RC=%ERRORLEVEL%"

if not "%RUN_RC%"=="0" (
  echo.
  echo [SAFE STOP] ALLEGRO cutover did not complete successfully.
  gh.exe run view 36225079305 --repo bevanshelton-netizen/allegro-vibez
  echo No OWNED LIVE VERIFIED claim will be made.
  pause
  exit /b %RUN_RC%
)

set "REPORT=%USERPROFILE%\Desktop\ALLEGRO-OWNED-DEPLOYMENT-REPORT.txt"
set "HEALTH=%TEMP%\allegro-owned-health.txt"
set "LANDING=%TEMP%\allegro-owned-landing.html"

echo.
echo === Independent owned public HTTPS verification ===
curl.exe --fail --silent --show-error --max-time 20 "https://allegro.izakhonoafrica.co.za/healthz" > "%HEALTH%"
if errorlevel 1 (
  echo [SAFE STOP] Public HTTPS health verification failed.
  > "%REPORT%" echo STATUS=PUBLIC_HTTPS_HEALTH_FAILED
  >> "%REPORT%" echo RUN_ID=36225079305
  >> "%REPORT%" echo HOST=https://allegro.izakhonoafrica.co.za
  >> "%REPORT%" echo GENERATED=%DATE% %TIME%
  echo Report: %REPORT%
  pause
  exit /b 4
)

curl.exe --fail --silent --show-error --max-time 20 "https://allegro.izakhonoafrica.co.za/" > "%LANDING%"
if errorlevel 1 (
  echo [SAFE STOP] Public landing page could not be retrieved.
  > "%REPORT%" echo STATUS=PUBLIC_LANDING_FAILED
  >> "%REPORT%" echo RUN_ID=36225079305
  >> "%REPORT%" echo HOST=https://allegro.izakhonoafrica.co.za
  >> "%REPORT%" echo GENERATED=%DATE% %TIME%
  echo Report: %REPORT%
  pause
  exit /b 5
)

findstr /I /C:"ALLEGRO" "%LANDING%" >nul
if errorlevel 1 (
  echo [SAFE STOP] Public landing page did not identify ALLEGRO.
  > "%REPORT%" echo STATUS=PUBLIC_IDENTITY_FAILED
  >> "%REPORT%" echo RUN_ID=36225079305
  >> "%REPORT%" echo HOST=https://allegro.izakhonoafrica.co.za
  >> "%REPORT%" echo GENERATED=%DATE% %TIME%
  echo Report: %REPORT%
  pause
  exit /b 6
)

> "%REPORT%" echo STATUS=OWNED_LIVE_VERIFIED
>> "%REPORT%" echo PRODUCT=ALLEGRO_VIBEZ
>> "%REPORT%" echo RUN_ID=36225079305
>> "%REPORT%" echo RELEASE_COMMIT=f28b1425c7400c6832baee0725214cb2a8ec1dcf
>> "%REPORT%" echo PUBLIC_HOST=https://allegro.izakhonoafrica.co.za
>> "%REPORT%" echo NODE01_RECOVERY=PASS
>> "%REPORT%" echo PRODUCTION_CUTOVER=PASS
>> "%REPORT%" echo HTTPS_HEALTH=PASS
>> "%REPORT%" echo ALLEGRO_IDENTITY=PASS
>> "%REPORT%" echo GENERATED=%DATE% %TIME%

echo.
echo =====================================================
echo      ALLEGRO IS OWNED LIVE VERIFIED
echo =====================================================
echo.
echo Public host: https://allegro.izakhonoafrica.co.za
echo Evidence: %REPORT%
echo.
pause
exit /b 0
