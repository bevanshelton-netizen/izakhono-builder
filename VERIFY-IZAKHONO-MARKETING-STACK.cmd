@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set REPORT=%USERPROFILE%\Desktop\IZAKHONO-MARKETING-STACK-REPORT.txt

(
  echo IZAKHONO MARKETING STACK STATUS REPORT
  echo Generated: %DATE% %TIME%
  echo ============================================================
  echo.
  echo [DOCKER]
  docker compose -f infra\marketing-stack\docker-compose.yml ps 2^>^&1
  echo.
  echo [LOCAL HEALTH]
  curl.exe -fsS http://127.0.0.1:8100/healthz 2^>^&1
  echo.
  echo.
  echo [LOCAL CREATE]
  curl.exe -fsSI http://127.0.0.1:8100/create/ 2^>^&1
  echo.
  echo [LOCAL ADS]
  curl.exe -fsSI http://127.0.0.1:8100/ads/ 2^>^&1
  echo.
  echo [CREATE HANDOFF CONTRACT]
  findstr /C:"izakhono_marketing_handoff_v1" apps\izakhono-create\index.html 2^>^&1
  echo.
  echo [ADS SOURCE GATE]
  findstr /C:"pkg.source==="IZAKHONO CREATE"" products\izakhono-ads\app.js 2^>^&1
  echo.
  echo [PUBLIC HEALTH - EXPECT FAILURE UNTIL DNS/TLS CUTOVER]
  curl.exe -fsSI https://marketing.izakhono.co.za/healthz 2^>^&1
  echo.
  echo [PUBLIC CREATE]
  curl.exe -fsSI https://marketing.izakhono.co.za/create/ 2^>^&1
  echo.
  echo [PUBLIC ADS]
  curl.exe -fsSI https://marketing.izakhono.co.za/ads/ 2^>^&1
  echo.
) > "%REPORT%"

echo Report written to:
echo %REPORT%
type "%REPORT%"
endlocal
