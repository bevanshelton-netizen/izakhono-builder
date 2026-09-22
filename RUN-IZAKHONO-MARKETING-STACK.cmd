@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IZAKHONO MARKETING STACK - NODE 01

cd /d "%~dp0"

echo ============================================================
echo IZAKHONO MARKETING STACK - OWNED NODE 01
echo CREATE -> ADS
echo ============================================================

where docker >nul 2>&1 || (
  echo [STOP] Docker is not installed or is not available in PATH.
  exit /b 1
)

docker info >nul 2>&1 || (
  echo [STOP] Docker is installed but the Docker engine is not running.
  exit /b 1
)

echo [1/6] Validating marketing compose...
docker compose -f infra\marketing-stack\docker-compose.yml config >nul
if errorlevel 1 (
  echo [STOP] Compose validation failed.
  exit /b 1
)

echo [2/6] Building CREATE + ADS...
docker compose -f infra\marketing-stack\docker-compose.yml build
if errorlevel 1 (
  echo [STOP] Marketing build failed.
  exit /b 1
)

echo [3/6] Starting owned marketing stack...
docker compose -f infra\marketing-stack\docker-compose.yml up -d
if errorlevel 1 (
  echo [STOP] Marketing stack failed to start.
  exit /b 1
)

echo [4/6] Waiting for same-origin gateway health...
for /L %%I in (1,1,20) do (
  curl.exe -fsS http://127.0.0.1:8100/healthz >nul 2>&1
  if not errorlevel 1 goto HEALTH_OK
  timeout /t 2 /nobreak >nul
)
echo [STOP] Marketing gateway did not become healthy.
docker compose -f infra\marketing-stack\docker-compose.yml ps
exit /b 1

:HEALTH_OK
echo [5/6] Verifying CREATE and ADS routes...
curl.exe -fsS http://127.0.0.1:8100/create/ | findstr /C:"IZAKHONO CREATE" >nul
if errorlevel 1 (
  echo [STOP] CREATE route failed content verification.
  exit /b 1
)
curl.exe -fsS http://127.0.0.1:8100/ads/ | findstr /C:"IZAKHONO ADS" >nul
if errorlevel 1 (
  echo [STOP] ADS route failed content verification.
  exit /b 1
)

echo [6/6] Verifying CREATE -> ADS contract markers...
findstr /C:"izakhono_marketing_handoff_v1" apps\izakhono-create\index.html >nul
if errorlevel 1 (
  echo [STOP] CREATE direct handoff marker missing.
  exit /b 1
)
findstr /C:"consumeCreateHandoff" products\izakhono-ads\app.js >nul
if errorlevel 1 (
  echo [STOP] ADS handoff consumer missing.
  exit /b 1
)
findstr /C:"pkg.source==="IZAKHONO CREATE"" products\izakhono-ads\app.js >nul
if errorlevel 1 (
  echo [STOP] ADS CREATE-source enforcement marker missing.
  exit /b 1
)

echo ============================================================
echo [PASS] IZAKHONO CREATE + ADS are running on owned NODE 01.
echo Local CREATE: http://127.0.0.1:8100/create/
echo Local ADS:    http://127.0.0.1:8100/ads/
echo.
echo PUBLIC EDGE REMAINS A SEPARATE GATE.
echo Do not call marketing.izakhono.co.za live until DNS/TLS/public
echo health and browser CREATE-to-ADS handoff are verified.
echo ============================================================
endlocal
