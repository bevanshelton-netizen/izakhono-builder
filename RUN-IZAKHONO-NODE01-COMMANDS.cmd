@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IZAKHONO NODE01 COMMAND CENTRE

cd /d "%~dp0"

echo ============================================================
echo IZAKHONO NODE01 - COMMAND CENTRE ONE CLICK
echo ============================================================

where docker >nul 2>&1 || (
  echo [STOP] Docker is not installed or not available in PATH.
  echo Install/start Docker Desktop or Docker Engine, then rerun.
  exit /b 1
)

docker info >nul 2>&1 || (
  echo [STOP] Docker is installed but the Docker engine is not running.
  exit /b 1
)

echo [1/5] Validating compose configuration...
docker compose -f internal\node01-command-gateway\docker-compose.yml config >nul
if errorlevel 1 (
  echo [STOP] Compose validation failed.
  exit /b 1
)

echo [2/5] Building IZAKHONO-owned gateway...
docker compose -f internal\node01-command-gateway\docker-compose.yml build
if errorlevel 1 (
  echo [STOP] Gateway build failed.
  exit /b 1
)

echo [3/5] Starting IZAKHONO-owned gateway...
docker compose -f internal\node01-command-gateway\docker-compose.yml up -d
if errorlevel 1 (
  echo [STOP] Gateway start failed.
  exit /b 1
)

echo [4/5] Verifying local health...
for /L %%I in (1,1,12) do (
  curl.exe -fsS http://127.0.0.1:8091/healthz > "%TEMP%\izakhono-node01-health.json" 2>nul
  if not errorlevel 1 goto HEALTH_OK
  timeout /t 2 /nobreak >nul
)
echo [STOP] NODE01 gateway did not become healthy.
docker compose -f internal\node01-command-gateway\docker-compose.yml ps
exit /b 1

:HEALTH_OK
type "%TEMP%\izakhono-node01-health.json"
echo.

echo [5/5] Verifying Command Centre page...
curl.exe -fsS http://127.0.0.1:8091/commands >nul
if errorlevel 1 (
  echo [STOP] Local Command Centre page is not reachable.
  exit /b 1
)

echo ============================================================
echo [PASS] IZAKHONO COMMANDS is running on owned NODE01.
echo Local: http://127.0.0.1:8091/commands
echo.
echo NEXT PUBLIC EDGE STEP:
echo Route commands.izakhono.co.za or ai.izakhono.co.za/commands
echo through the owned TLS proxy to 127.0.0.1:8091.
echo ============================================================
endlocal
