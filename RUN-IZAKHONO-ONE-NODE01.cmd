@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where docker >nul 2>&1 || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Docker_not_found
  exit /b 1
)

docker compose version >nul 2>&1 || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Docker_Compose_not_found
  exit /b 1
)

docker network inspect izakhono_private >nul 2>&1 || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=izakhono_private_network_missing
  echo NEXT=Run START-APP-FABRIC-NODE01.cmd first
  exit /b 1
)

set FLOW_STATE=
for /f "delims=" %%I in ('docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" izakhono-flow 2^>nul') do set FLOW_STATE=%%I
if /I not "%FLOW_STATE%"=="healthy" (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=IZAKHONO_FLOW_not_healthy
  echo FLOW_STATE=%FLOW_STATE%
  echo NEXT=Run START-APP-FABRIC-NODE01.cmd first
  exit /b 1
)

set IZAKHONO_FLOW_INTERNAL_URL=http://izakhono-flow:8794
set COMPOSE_FILE=products\izakhono-one\compose.owned.yml

docker compose -f "%COMPOSE_FILE%" config --quiet || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Owned_compose_config_failed
  echo NEXT=Ensure products\izakhono-one\.env.owned exists on NODE01 and contains the required backend environment
  exit /b 1
)

docker rm -f izakhono-one >nul 2>&1

docker compose -f "%COMPOSE_FILE%" build izakhono-one || exit /b 1
docker compose -f "%COMPOSE_FILE%" up -d izakhono-one || exit /b 1

powershell -NoProfile -Command "$ok=$false; 1..30 ^| %% { try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/health -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}" || (
  echo IZAKHONO_ONE=BLOCKED
  echo REASON=Health_check_failed
  docker compose -f "%COMPOSE_FILE%" ps
  exit /b 1
)
powershell -NoProfile -Command "$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/api/builder -TimeoutSec 2; $j=$r.Content ^| ConvertFrom-Json; if($r.StatusCode -ne 200 -or -not $j.integrated -or -not $j.engineIndependent){exit 1}" || exit /b 1
powershell -NoProfile -Command "$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/api/flow -TimeoutSec 2; $j=$r.Content ^| ConvertFrom-Json; if($r.StatusCode -ne 200 -or -not $j.integrated -or -not $j.engineIndependent -or -not $j.internalHealthConfigured){exit 1}" || exit /b 1
powershell -NoProfile -Command "$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8781/api/flow/health -TimeoutSec 4; $j=$r.Content ^| ConvertFrom-Json; if($r.StatusCode -ne 200 -or -not $j.ok -or $j.upstreamStatus -ne 200 -or $j.service.service -ne 'izakhono-flow'){exit 1}" || exit /b 1

echo IZAKHONO_ONE_NODE01=INTERNAL_PASS
echo BUILDER_INTEGRATION=SOURCE_BRIDGE_PASS
echo FLOW_INTEGRATION=INTERNAL_HEALTH_PASS
echo FLOW_INTERNAL_URL=%IZAKHONO_FLOW_INTERNAL_URL%
if defined IZAKHONO_BUILDER_INTERNAL_URL (
  echo BUILDER_INTERNAL_HEALTH=CHECK_/api/builder/health
) else (
  echo BUILDER_INTERNAL_HEALTH=GATED_UNTIL_IZAKHONO_BUILDER_INTERNAL_URL_IS_SET
)
echo URL=http://127.0.0.1:8781/
echo PUBLIC_HTTPS=NOT_YET_VERIFIED
endlocal
