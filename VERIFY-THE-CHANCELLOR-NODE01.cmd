@echo off
setlocal EnableExtensions
title THE CHANCELLOR - VERIFY NODE01
cd /d "%~dp0"

set REPORT=%USERPROFILE%\Desktop\THE-CHANCELLOR-NODE01-STATUS.txt

(
  echo THE CHANCELLOR - IZAKHONO NODE01 STATUS
  echo Generated: %DATE% %TIME%
  echo ============================================================
  echo.
  echo [CONTAINER]
  docker ps --filter "name=the-chancellor" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2^>^&1
  echo.
  echo [HEALTH]
  curl.exe -fsS http://127.0.0.1:3000/api/health 2^>^&1
  echo.
  echo.
  echo [FEATURES]
  curl.exe -fsS http://127.0.0.1:3000/api/features 2^>^&1
  echo.
  echo.
  echo [GO-LIVE]
  curl.exe -fsS http://127.0.0.1:3000/api/go-live 2^>^&1
  echo.
) > "%REPORT%"

echo Report written to:
echo %REPORT%
echo.
type "%REPORT%"

curl.exe -fsS http://127.0.0.1:3000/api/health >nul 2>&1
if errorlevel 1 (
  echo.
  echo [FAIL] Local Chancellor health is not passing.
  exit /b 1
)

echo.
echo [PASS] Local Chancellor health is passing on NODE01.
echo [HOLD] Do not label OWNED LIVE VERIFIED until EDGE/TLS/DNS and public HTTPS verification also pass.
endlocal
