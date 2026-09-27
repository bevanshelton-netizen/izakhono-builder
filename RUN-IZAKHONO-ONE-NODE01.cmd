@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>&1 || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Docker_not_found
  exit /b 1
)
docker build -t izakhono-one:1.1.0 products\izakhono-one || exit /b 1
docker rm -f izakhono-one >nul 2>&1
docker run -d --name izakhono-one --restart unless-stopped -e IZAKHONO_BUILDER_INTERNAL_URL -p 127.0.0.1:8781:8781 izakhono-one:1.1.0 || exit /b 1
powershell -NoProfile -Command "$ok=$false; 1..30 ^| %% { try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/health -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}" || exit /b 1
powershell -NoProfile -Command "$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/api/builder -TimeoutSec 2; $j=$r.Content ^| ConvertFrom-Json; if($r.StatusCode -ne 200 -or -not $j.integrated -or -not $j.engineIndependent){exit 1}" || exit /b 1
echo IZAKHONO_ONE_NODE01=INTERNAL_PASS
echo BUILDER_INTEGRATION=SOURCE_BRIDGE_PASS
if defined IZAKHONO_BUILDER_INTERNAL_URL (
  echo BUILDER_INTERNAL_HEALTH=CHECK_/api/builder/health
) else (
  echo BUILDER_INTERNAL_HEALTH=GATED_UNTIL_IZAKHONO_BUILDER_INTERNAL_URL_IS_SET
)
echo URL=http://127.0.0.1:8781/
echo PUBLIC_HTTPS=NOT_YET_VERIFIED
endlocal
