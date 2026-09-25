@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set REPORT=%USERPROFILE%\Desktop\IZAKHONO-COMMANDS-STATUS-REPORT.txt

(
  echo IZAKHONO COMMANDS STATUS REPORT
  echo Generated: %DATE% %TIME%
  echo ============================================================
  echo.
  echo [COMMAND GATEWAY]
  wsl.exe -d Ubuntu -u root -- bash -lc "curl -fsS http://127.0.0.1:8091/healthz" 2^>^&1
  echo.
  echo [IZAKHONO NODE]
  wsl.exe -d Ubuntu -u root -- bash -lc "curl -fsS http://127.0.0.1:9191/readyz" 2^>^&1
  echo.
  echo [IZAKHONO CONTROL]
  wsl.exe -d Ubuntu -u root -- bash -lc "curl -fsS http://127.0.0.1:9292/healthz" 2^>^&1
  echo.
  echo [OWNED CODE]
  wsl.exe -d Ubuntu -u root -- bash -lc "curl -fsS http://127.0.0.1:8860/health" 2^>^&1
  echo.
  echo [EXTERNAL RESILIENCE]
  curl.exe -fsS "https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-commands?api=health" 2^>^&1
  echo.
  echo [PUBLIC OWNED HOST]
  curl.exe -fsSI https://ai.izakhono.co.za/commands 2^>^&1
  echo.
) > "%REPORT%"

echo Report written to:
echo %REPORT%
type "%REPORT%"
endlocal
