#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo '[STOP] Run as root on NODE01.'
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRET_DIR=/opt/izakhono/secrets
EVIDENCE_DIR=/opt/izakhono/evidence
ENV_FILE="$SECRET_DIR/app-fabric-runtime.env"
COMPOSE="$SCRIPT_DIR/docker-compose.yml"
REPORT="${1:-/opt/izakhono/evidence/APP-FABRIC-NODE01-REPORT.json}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "[STOP] Missing dependency: $1"; exit 1; }; }
for x in docker openssl curl jq; do need "$x"; done
docker compose version >/dev/null 2>&1 || { echo '[STOP] Docker Compose v2 is required.'; exit 1; }

for network in izakhono_public izakhono_private; do
  docker network inspect "$network" >/dev/null 2>&1 || {
    echo "[STOP] Required owned network $network is missing. Run the IZAKHONO owner-host foundation first."
    exit 1
  }
done

mkdir -p "$SECRET_DIR" "$EVIDENCE_DIR" "$(dirname "$REPORT")"
chmod 700 "$SECRET_DIR" "$EVIDENCE_DIR" || true

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
CRM_ADMIN_TOKEN=$(openssl rand -hex 32)
CRM_INGEST_TOKEN=$(openssl rand -hex 32)
IZAKHONO_FABRIC_INTERNAL_TOKEN=$(openssl rand -hex 32)
IZAKHONO_FABRIC_PUBLIC_INTAKE=false
IZAKHONO_FABRIC_ALLOWED_ORIGINS=
IZAKHONO_FABRIC_ALLOW_ORIGINLESS=false
EOF
  chmod 600 "$ENV_FILE"
  echo '[PASS] Generated owner-only APP FABRIC runtime secrets.'
else
  chmod 600 "$ENV_FILE"
  echo '[PASS] Existing APP FABRIC runtime secrets preserved.'
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo '[1/5] Building CRM + APP FABRIC images from canonical source...'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" build

echo '[2/5] Starting internal owned runtime...'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" up -d

echo '[3/5] Waiting for container health...'
for i in $(seq 1 30); do
  CRM_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-crm 2>/dev/null || true)"
  FABRIC_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-app-fabric-gateway 2>/dev/null || true)"
  if [ "$CRM_STATE" = healthy ] && [ "$FABRIC_STATE" = healthy ]; then break; fi
  sleep 2
done
[ "${CRM_STATE:-}" = healthy ] || { echo "[FAIL] CRM state: ${CRM_STATE:-missing}"; exit 1; }
[ "${FABRIC_STATE:-}" = healthy ] || { echo "[FAIL] APP FABRIC state: ${FABRIC_STATE:-missing}"; exit 1; }

echo '[4/5] Running authenticated non-writing gateway -> CRM proof...'
SELFTEST="$(curl -fsS -X POST -H "Authorization: Bearer $IZAKHONO_FABRIC_INTERNAL_TOKEN" http://127.0.0.1:18090/api/fabric/selftest)"
echo "$SELFTEST" | jq -e '.ok == true and .mode == "non-writing" and .crm.dry_run == true' >/dev/null

echo '[5/5] Recording owned runtime evidence...'
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo local-source)"
CRM_IMAGE="$(docker inspect -f '{{.Image}}' izakhono-crm)"
FABRIC_IMAGE="$(docker inspect -f '{{.Image}}' izakhono-app-fabric-gateway)"
PUBLIC_ENABLED="$(echo "$SELFTEST" >/dev/null; curl -fsS http://127.0.0.1:18090/health | jq -r '.public_intake')"

jq -n   --arg schema 'izakhono.app-fabric.node01.report.v1'   --arg generated "$STARTED"   --arg commit "$COMMIT"   --arg crm_state "$CRM_STATE"   --arg fabric_state "$FABRIC_STATE"   --arg crm_image "$CRM_IMAGE"   --arg fabric_image "$FABRIC_IMAGE"   --argjson public_intake "$PUBLIC_ENABLED"   '{
    schema:$schema,
    generated_at:$generated,
    git_commit:$commit,
    overall:"PASS_INTERNAL_OWNED",
    crm:{health:$crm_state,image:$crm_image,host_loopback:"127.0.0.1:18080"},
    fabric:{health:$fabric_state,image:$fabric_image,host_loopback:"127.0.0.1:18090",public_intake:$public_intake},
    integration:{gateway_to_crm:"PASS_NON_WRITING"},
    secrets:{location:"/opt/izakhono/secrets/app-fabric-runtime.env",mode:"owner-only",values_exported:false},
    persistence:{crm_volume:"izakhono_crm_data",outbox_volume:"izakhono_fabric_outbox"},
    public_cutover_performed:false,
    public_status:"NOT_YET_VERIFIED",
    next_gate:"approved hostname + allowed origins + EDGE/TLS + real platform event acceptance"
  }' > "$REPORT"
chmod 600 "$REPORT"

echo
echo '[PASS] IZAKHONO APP FABRIC internal owned runtime is healthy.'
echo "Evidence: $REPORT"
echo '[HOLD] Public intake remains fail-closed until the separate EDGE activation gate is reviewed and applied.'
