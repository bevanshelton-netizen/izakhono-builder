@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFY-OWNER-NODE.ps1"
if errorlevel 1 (
  echo.
  echo OWNER NODE PROOF DID NOT PASS. Leave this window open and photograph it.
  pause
) else (
  echo.
  echo OWNER NODE PROOF PASSED.
  pause
)
