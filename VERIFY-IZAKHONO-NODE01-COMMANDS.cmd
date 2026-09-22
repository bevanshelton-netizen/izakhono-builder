@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set REPORT=%USERPROFILE%\Desktop\IZAKHONO-COMMANDS-STATUS-REPORT.txt

(
  echo IZAKHONO COMMANDS STATUS REPORT
  echo Generated: %DATE% %TIME%
  echo ============================================================
  echo.
  echo [DOCKER]
  docker compose -f internal\node01-command-gateway\docker-compose.yml ps 2^>^&1
  echo.
  echo [NODE01 HEALTH]
  curl.exe -fsS http://127.0.0.1:8091/healthz 2^>^&1
  echo.
  echo.
  echo [NODE01 COMMAND PAGE]
  curl.exe -fsSI http://127.0.0.1:8091/commands 2^>^&1
  echo.
  echo [EXTERNAL RESILIENCE]
  curl.exe -fsS "https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-commands?api=health" 2^>^&1
  echo.
  echo.
  echo [PUBLIC OWNED HOST]
  curl.exe -fsSI https://ai.izakhono.co.za/commands 2^>^&1
  echo.
) > "%REPORT%"

echo Report written to:
echo %REPORT%
type "%REPORT%"
endlocal
