@echo off
setlocal EnableExtensions
title VERIFY IZAKHONO SHORTS - NODE01

set EVIDENCE_DIR=%USERPROFILE%\Desktop\IZAKHONO-SHORTS-EVIDENCE
set E2E_REPORT=%EVIDENCE_DIR%\IZAKHONO-SHORTS-E2E-REPORT.json
set E2E_VIDEO=%EVIDENCE_DIR%\IZAKHONO-FIRST-OWNED-SHORT.mp4

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$h=Invoke-RestMethod -Uri 'http://127.0.0.1:9710/healthz' -TimeoutSec 5;" ^
  "if(-not $h.ok){throw 'factory health check failed'};" ^
  "if($h.external_fallback_enabled){throw 'external fallback must be disabled'};" ^
  "if(-not $h.owned_renderer_key_configured){throw 'owned renderer key is missing'};" ^
  "$rh=Invoke-RestMethod -Uri 'http://127.0.0.1:9721/healthz' -TimeoutSec 5;" ^
  "if(-not $rh.ok){throw 'owned renderer health check failed'};" ^
  "if(-not (Test-Path '%E2E_REPORT%')){throw 'E2E evidence report missing'};" ^
  "$r=Get-Content '%E2E_REPORT%' -Raw | ConvertFrom-Json;" ^
  "if(-not $r.ok -or -not $r.live_claim_allowed){throw 'E2E evidence gate has not passed'};" ^
  "if(-not (Test-Path '%E2E_VIDEO%')){throw 'generated MP4 evidence missing'};" ^
  "$v=Get-Item '%E2E_VIDEO%'; if($v.Length -lt 4096){throw 'generated MP4 evidence is too small'};" ^
  "[pscustomobject]@{factory=$h.service;renderer=$rh.service;e2e_ok=$r.ok;live_claim_allowed=$r.live_claim_allowed;video_bytes=$v.Length;video_path=$v.FullName} | ConvertTo-Json -Depth 5"

if errorlevel 1 (
  echo [FAIL] IZAKHONO SHORTS has not passed the real owned render evidence gate.
  exit /b 1
)

echo.
echo [PASS] IZAKHONO SHORTS FACTORY is verified by health + real MP4 evidence.
endlocal
