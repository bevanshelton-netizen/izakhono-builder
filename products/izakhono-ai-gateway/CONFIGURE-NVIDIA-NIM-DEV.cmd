@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%CONFIGURE-NVIDIA-NIM-DEV.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo NVIDIA NIM development route configuration failed with code %RC%.
  pause
)
exit /b %RC%
