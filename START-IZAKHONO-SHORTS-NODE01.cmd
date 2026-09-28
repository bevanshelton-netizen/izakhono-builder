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
set SPEECH_REPORT=%USERPROFILE%\Desktop\IZAKHONO-SPEECH-RUNTIME-REPORT.json
set VIDEO_REPORT=%USERPROFILE%\Desktop\IZAKHONO-VIDEO-RUNTIME-REPORT.json
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%REPORT%"`) do set LINUX_REPORT=%%I
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%SPEECH_REPORT%"`) do set LINUX_SPEECH_REPORT=%%I
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%VIDEO_REPORT%"`) do set LINUX_VIDEO_REPORT=%%I

echo ============================================================
echo IZAKHONO SHORTS FACTORY - OWNED END-TO-END STACK
echo NODE01 / WSL GPU RENDERER + DOCKER CONTROL PLANE
echo ============================================================
echo.

echo [QUALITY 1/2] Preparing IZAKHONO natural speech runtime...
wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-speech-runtime/install-node01.sh" "%LINUX_SPEECH_REPORT%"
set SPEECH_RC=%ERRORLEVEL%
if "%SPEECH_RC%"=="0" (
  echo [QUALITY] Natural speech runtime READY.
) else if "%SPEECH_RC%"=="2" (
  echo [QUALITY] Natural speech model not staged yet. Local espeak fallback remains active.
) else (
  echo [QUALITY WARN] Speech setup returned %SPEECH_RC%. Baseline local speech remains available.
)

echo.
echo [QUALITY 2/2] Preparing IZAKHONO generative video runtime...
wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/products/izakhono-video-runtime/install-node01.sh" "%LINUX_VIDEO_REPORT%"
set VIDEO_RC=%ERRORLEVEL%
if "%VIDEO_RC%"=="0" (
  echo [QUALITY] Generative video runtime READY.
) else if "%VIDEO_RC%"=="2" (
  echo [QUALITY] Wan model/GPU gate not ready yet. Local FFmpeg motion fallback remains active.
) else (
  echo [QUALITY WARN] Video setup returned %VIDEO_RC%. Baseline local motion remains available.
)

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

powershell -NoProfile -Command "$r=Invoke-RestMethod -Uri 'http://127.0.0.1:9710/healthz' -TimeoutSec 10; if(-not $r.ok){exit 1}; if($r.external_fallback_enabled){exit 2}; if(-not $r.owned_renderer_key_configured){exit 3}; $r | ConvertTo-Json -Depth 5"
if errorlevel 1 (
  echo [FAIL] Shorts control plane health/security check failed.
  exit /b 1
)

set EVIDENCE_DIR=%USERPROFILE%\Desktop\IZAKHONO-SHORTS-EVIDENCE
if not exist "%EVIDENCE_DIR%" mkdir "%EVIDENCE_DIR%"

echo.
echo ============================================================
echo Running a REAL owned end-to-end Short render.
echo This gate must produce and re-download an actual MP4 before
echo the launcher is allowed to print LIVE/operational success.
echo ============================================================
echo.

docker run --rm ^
  -v "%EVIDENCE_DIR%:/evidence" ^
  izakhono-shorts ^
  python e2e.py --base http://host.docker.internal:9710 --evidence-dir /evidence --timeout 2400 --poll 5
set E2E_RC=%ERRORLEVEL%

if not "%E2E_RC%"=="0" (
  echo.
  echo ============================================================
  echo [SAFE STOP] The stack started, but a real owned MP4 did not
  echo pass the end-to-end gate. No LIVE claim is allowed.
  echo Evidence: %EVIDENCE_DIR%\IZAKHONO-SHORTS-E2E-REPORT.json
  echo ============================================================
  exit /b %E2E_RC%
)

echo.
echo ============================================================
echo [PASS] IZAKHONO SHORTS IS OPERATIONAL ON NODE01.
echo A real owned 1080x1920 MP4 passed the end-to-end evidence gate.
echo UI:       http://127.0.0.1:9710
echo Renderer: http://127.0.0.1:9721/healthz
echo Video:    %EVIDENCE_DIR%\IZAKHONO-FIRST-OWNED-SHORT.mp4
echo Report:   %EVIDENCE_DIR%\IZAKHONO-SHORTS-E2E-REPORT.json
echo Speech evidence: %SPEECH_REPORT%
echo Video evidence:  %VIDEO_REPORT%
echo.
if "%SPEECH_RC%"=="0" (echo Natural voice: READY) else (echo Natural voice: FALLBACK MODE)
if "%VIDEO_RC%"=="0" (echo Generative animation: READY) else (echo Generative animation: FALLBACK MODE)
echo ============================================================
endlocal
