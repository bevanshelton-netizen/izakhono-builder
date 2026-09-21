@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IZAKHONO COMMANDS - OWNER DEPLOY

echo ============================================================
echo IZAKHONO COMMANDS - OWNER / NODE01 DEPLOY
echo ============================================================
echo This launcher validates and deploys IZAKHONO Builder without
echo storing Cloudflare credentials in source control.
echo.

where node >nul 2>&1 || (
  echo [STOP] Node.js is not available on this machine.
  exit /b 1
)
where npx >nul 2>&1 || (
  echo [STOP] npx is not available on this machine.
  exit /b 1
)

echo [1/6] Checking Cloudflare login...
call npx wrangler whoami >nul 2>&1
if errorlevel 1 (
  echo Cloudflare login is not active. Opening Wrangler login...
  call npx wrangler login
  if errorlevel 1 (
    echo [STOP] Cloudflare login failed.
    exit /b 1
  )
)

echo [2/6] Installing project dependencies...
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo [STOP] Dependency installation failed.
  exit /b 1
)

echo [3/6] Validating production bundle...
call npm run validate
if errorlevel 1 (
  echo [STOP] Validation failed. Nothing was deployed.
  exit /b 1
)

echo [4/6] Deploying Worker and static assets...
call npx wrangler deploy
if errorlevel 1 (
  echo [STOP] Cloudflare deployment failed.
  exit /b 1
)

echo [5/6] Verifying public health endpoint...
curl.exe -fsS https://ai.izakhono.co.za/api/health
if errorlevel 1 (
  echo.
  echo [WARN] Deployment completed, but public health verification failed.
  echo Check DNS/TLS for ai.izakhono.co.za before calling it live.
  exit /b 2
)
echo.

echo [6/6] Verifying Command Centre deployment marker...
curl.exe -fsS https://ai.izakhono.co.za/commands/deploy.json
if errorlevel 1 (
  echo.
  echo [WARN] Worker is responding, but /commands/deploy.json is not reachable.
  echo Do not call the Command Centre live yet.
  exit /b 3
)
echo.
echo ============================================================
echo [PASS] IZAKHONO COMMANDS is deployed and publicly reachable.
echo Open: https://ai.izakhono.co.za/commands
echo ============================================================
endlocal
