@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-DEEPSEEK-HARNESS-SANDBOX.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo IZAKHONO Harness sandbox failed with exit code %EXITCODE%.
  pause
)
exit /b %EXITCODE%
