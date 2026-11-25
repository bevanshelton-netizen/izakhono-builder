#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf '\nIZAKHONO HOST — NODE01 ACTIVATION\n\n'

# Stage 1: host/network preflight.
./NODE-PREFLIGHT.sh

# Stage 2: bootstrap the owned runtime. This creates local secrets when
# necessary, validates compose, starts the stack and waits for health.
./bootstrap-owned.sh

# Optional Stage 2b: start the DEPLOY API only when the detached owner approval
# explicitly includes activate-deploy-control-api. The service has its own
# database-role, append-only audit and FORTRESS introspection startup gates.
if [[ "${IZAKHONO_ACTIVATE_DEPLOY_CONTROL:-0}" == "1" ]]; then
  echo "[DEPLOY] Owner approval includes activate-deploy-control-api; validating profile."
  docker compose --env-file .env -f docker-compose.owned.yml --profile deploy-control config >/dev/null
  docker compose --env-file .env -f docker-compose.owned.yml --profile deploy-control up -d deploy-control
  deploy_control_healthy=0
  for i in {1..30}; do
    if docker compose --env-file .env -f docker-compose.owned.yml exec -T deploy-control node -e "fetch('http://127.0.0.1:8090/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      deploy_control_healthy=1
      break
    fi
    sleep 2
  done
  if [[ "$deploy_control_healthy" != "1" ]]; then
    docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 deploy-control >&2 || true
    echo "DEPLOY API did not pass its startup gates; NODE01 activation is blocked." >&2
    exit 1
  fi
else
  echo "[DEPLOY] Optional DEPLOY API profile not authorised by signed owner approval; not started."
fi

# Stage 3: formal compliance gate. Activation is not considered complete
# unless the post-bootstrap node satisfies the same acceptance contract used
# by the compliance report.
./NODE-COMPLIANCE.sh

# Stage 4: explicit local health evidence.
echo
curl -fsS http://127.0.0.1:8080/health
echo

echo "NODE01 ACTIVATION: PASSED"
echo "Owned runtime is healthy and the compliance gate passed."
echo "Verification:"
echo "  docker compose --env-file .env -f docker-compose.owned.yml ps"
echo "  docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 host-runtime edge"
echo "  ss -lntup | grep -E ':(53|80|443)\\b'"
echo
