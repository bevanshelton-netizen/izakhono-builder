@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ============================================================
echo        IZAKHONO SIGN - FINAL PUBLIC ACTIVATION
echo ============================================================
echo.
set /p SIGN_HOSTNAME=Approved SIGN hostname: 
if "%SIGN_HOSTNAME%"=="" (
  echo Hostname is required.
  pause
  exit /b 2
)
set /p FALLBACK_URL=Verified HTTPS fallback URL: 
if "%FALLBACK_URL%"=="" (
  echo Fallback URL is required.
  pause
  exit /b 3
)
echo.
choice /C YN /N /M "Apply the local EDGE route after dry-run? [Y/N] "
set APPLY=
if errorlevel 2 goto noapply
set APPLY=-ApplyEdge
:noapply
echo.
choice /C YN /N /M "Run public DNS/TLS verification now? [Y/N] "
set VERIFY=
if errorlevel 2 goto noverify
set VERIFY=-VerifyPublic
:noverify
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FINALIZE-IZAKHONO-SIGN-PUBLIC.ps1" -Hostname "%SIGN_HOSTNAME%" -FallbackUrl "%FALLBACK_URL%" %APPLY% %VERIFY%
if errorlevel 1 (
  echo.
  echo Activation stopped at an evidence gate.
  echo Review the Desktop JSON report and log.
  pause
  exit /b 1
)
echo.
echo Activation sequence completed for the selected gates.
pause
endlocal
