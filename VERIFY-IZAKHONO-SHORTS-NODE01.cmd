@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $r=Invoke-RestMethod -Uri 'http://127.0.0.1:9710/healthz' -TimeoutSec 5; if(-not $r.ok){throw 'health check failed'}; $r | ConvertTo-Json -Depth 5"
if errorlevel 1 exit /b 1
echo IZAKHONO SHORTS FACTORY control plane verified.
endlocal
