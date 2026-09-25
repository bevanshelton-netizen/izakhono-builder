@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>&1 || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Docker_not_found
  exit /b 1
)
docker build -t izakhono-one:1.0.0 products\izakhono-one || exit /b 1
docker rm -f izakhono-one >nul 2>&1
docker run -d --name izakhono-one --restart unless-stopped -p 127.0.0.1:8781:8781 izakhono-one:1.0.0 || exit /b 1
powershell -NoProfile -Command "$ok=$false; 1..30 ^| %% { try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/health -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}" || exit /b 1
echo IZAKHONO_ONE_NODE01=INTERNAL_PASS
echo URL=http://127.0.0.1:8781/
echo PUBLIC_HTTPS=NOT_YET_VERIFIED
endlocal
