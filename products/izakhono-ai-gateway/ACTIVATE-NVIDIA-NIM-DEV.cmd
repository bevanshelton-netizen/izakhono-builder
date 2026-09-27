@echo off
setlocal
set "HERE=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%HERE%ACTIVATE-NVIDIA-NIM-DEV.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo IZAKHONO NVIDIA development activation failed with code %RC%.
  pause
)
exit /b %RC%
