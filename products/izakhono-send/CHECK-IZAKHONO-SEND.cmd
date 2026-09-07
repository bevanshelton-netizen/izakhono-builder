@echo off
powershell -NoProfile -Command "try { $r=Invoke-RestMethod 'http://127.0.0.1:8787/healthz' -TimeoutSec 3; $r | ConvertTo-Json -Compress; if(-not $r.ok){exit 2} } catch { Write-Host 'IZAKHONO SEND is not active on this laptop.'; exit 1 }"
pause
