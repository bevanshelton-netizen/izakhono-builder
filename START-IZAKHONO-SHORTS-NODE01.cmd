@echo off
setlocal EnableExtensions
title IZAKHONO SHORTS FACTORY - NODE01

cd /d "%~dp0"

where wsl.exe >nul 2>&1 || (
  echo [STOP] WSL is not available.
  exit /b 1
)
where docker.exe >nul 2>&1 || (
  echo [STOP] Docker is not available.
  exit /b 1
)

set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
if "%LINUX_ROOT%"=="" (
  echo [STOP] Could not map repository path into WSL.
  exit /b 1
)

set REPORT=%USERPROFILE%\Desktop\IZAKHONO-SHORTS-RENDERER-REPORT.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I

echo ============================================================
echo IZAKHONO SHORTS FACTORY - OWNED END-TO-END STACK
echo NODE01 / WSL GPU RENDERER + DOCKER CONTROL PLANE
echo ============================================================
echo.

wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-shorts-renderer/install-node01.sh" "%LINUX_REPORT%"
set RENDER_RC=%ERRORLEVEL%

echo.
if exist "%REPORT%" (
  echo Renderer evidence report:
  type "%REPORT%"
  echo.
)

if "%RENDER_RC%"=="2" (
  echo ============================================================
  echo [ACTION NEEDED] Renderer software is installed, but GPU/model
  echo readiness is not yet proven. No false LIVE status is claimed.
  echo ============================================================
  exit /b 2
)
if not "%RENDER_RC%"=="0" (
  echo [FAIL] Renderer activation stopped with exit code %RENDER_RC%.
  exit /b %RENDER_RC%
)

for /f "usebackq delims=" %%K in (`wsl.exe -d %DISTRO% -u root -- bash -lc "sed -n 's/^IZAKHONO_SHORTS_RENDER_KEY=//p' /etc/izakhono/apps/izakhono-shorts-renderer.env | tail -1"`) do set RENDER_KEY=%%K
if "%RENDER_KEY%"=="" (
  echo [STOP] Renderer secret could not be read from WSL.
  exit /b 1
)

cd /d "%~dp0apps\izakhono-shorts"
docker volume create izakhono-shorts-jobs >nul 2>&1
docker build -t izakhono-shorts . || exit /b 1

docker rm -f izakhono-shorts-api >nul 2>&1
docker rm -f izakhono-shorts-worker >nul 2>&1

docker run -d --name izakhono-shorts-api --restart unless-stopped ^
  -p 9710:9710 ^
  -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 ^
  -e IZAKHONO_SHORTS_RENDER_KEY=%RENDER_KEY% ^
  -e IZAKHONO_SHORTS_ALLOW_EXTERNAL_FALLBACK=false ^
  -v izakhono-shorts-jobs:/app/data/jobs ^
  izakhono-shorts || exit /b 1

docker run -d --name izakhono-shorts-worker --restart unless-stopped ^
  -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 ^
  -e IZAKHONO_SHORTS_RENDER_KEY=%RENDER_KEY% ^
  -e IZAKHONO_SHORTS_ALLOW_EXTERNAL_FALLBACK=false ^
  -v izakhono-shorts-jobs:/app/data/jobs ^
  izakhono-shorts python worker.py || exit /b 1

powershell -NoProfile -Command "$r=Invoke-RestMethod -Uri 'http://127.0.0.1:9710/healthz' -TimeoutSec 10; if(-not $r.ok){exit 1}; $r | ConvertTo-Json -Depth 5"
if errorlevel 1 (
  echo [FAIL] Shorts control plane health check failed.
  exit /b 1
)

echo.
echo ============================================================
echo [PASS] IZAKHONO SHORTS control plane and owned renderer are up.
echo UI:       http://127.0.0.1:9710
echo Renderer: http://127.0.0.1:9721/healthz
echo ============================================================
endlocal
