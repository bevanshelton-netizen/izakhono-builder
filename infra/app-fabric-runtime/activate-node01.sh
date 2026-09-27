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
umask 077
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

ensure_env_secret(){
  local key="$1"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$(openssl rand -hex 32)" >> "$ENV_FILE"
  fi
}
ensure_env_value(){
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_env_secret CRM_ADMIN_TOKEN
ensure_env_secret CRM_INGEST_TOKEN
ensure_env_secret IZAKHONO_FABRIC_INTERNAL_TOKEN
ensure_env_secret FLOW_ADMIN_TOKEN
ensure_env_secret FLOW_INGEST_TOKEN
ensure_env_value FLOW_ADAPTERS_JSON '{}'
ensure_env_value IZAKHONO_FABRIC_PUBLIC_INTAKE false
ensure_env_value IZAKHONO_FABRIC_ALLOWED_ORIGINS ''
ensure_env_value IZAKHONO_FABRIC_ALLOW_ORIGINLESS false

echo '[PASS] Owner-only APP FABRIC + FLOW runtime secrets/config are present.'

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[ -n "${FLOW_ADMIN_TOKEN:-}" ] || { echo '[FAIL] FLOW_ADMIN_TOKEN is empty.'; exit 1; }
[ -n "${FLOW_INGEST_TOKEN:-}" ] || { echo '[FAIL] FLOW_INGEST_TOKEN is empty.'; exit 1; }

echo '[1/7] Building CRM + FLOW + APP FABRIC images from canonical source...'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" build

echo '[2/7] Starting internal owned runtime...'
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" up -d

echo '[3/7] Waiting for CRM + FLOW + APP FABRIC container health...'
for i in $(seq 1 45); do
  CRM_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-crm 2>/dev/null || true)"
  FLOW_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-flow 2>/dev/null || true)"
  FABRIC_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-app-fabric-gateway 2>/dev/null || true)"
  if [ "$CRM_STATE" = healthy ] && [ "$FLOW_STATE" = healthy ] && [ "$FABRIC_STATE" = healthy ]; then break; fi
  sleep 2
done
[ "${CRM_STATE:-}" = healthy ] || { echo "[FAIL] CRM state: ${CRM_STATE:-missing}"; exit 1; }
[ "${FLOW_STATE:-}" = healthy ] || { echo "[FAIL] FLOW state: ${FLOW_STATE:-missing}"; exit 1; }
[ "${FABRIC_STATE:-}" = healthy ] || { echo "[FAIL] APP FABRIC state: ${FABRIC_STATE:-missing}"; exit 1; }

echo '[4/7] Running authenticated non-writing gateway -> CRM proof...'
SELFTEST="$(docker exec izakhono-app-fabric-gateway node -e "fetch('http://127.0.0.1:8090/api/fabric/selftest',{method:'POST',headers:{authorization:'Bearer '+process.env.IZAKHONO_FABRIC_INTERNAL_TOKEN}}).then(async r=>{const t=await r.text();if(!r.ok){console.error(t);process.exit(1)};process.stdout.write(t)}).catch(e=>{console.error(e);process.exit(1)})")"
echo "$SELFTEST" | jq -e '.ok == true and .mode == "non-writing" and .crm.dry_run == true' >/dev/null

echo '[5/7] Proving FLOW health + owner-authenticated scoped read...'
FLOW_HEALTH="$(docker exec izakhono-flow node -e "fetch('http://127.0.0.1:8794/health').then(async r=>{const v=await r.json();if(!r.ok||!v.ok)process.exit(1);process.stdout.write(JSON.stringify(v))}).catch(()=>process.exit(1))")"
echo "$FLOW_HEALTH" | jq -e '.ok == true and .service == "izakhono-flow" and .engineIndependent == true and .noTracking == true' >/dev/null
FLOW_AUTH_PROOF="$(docker exec izakhono-flow node -e "fetch('http://127.0.0.1:8794/api/summary',{headers:{authorization:'Bearer '+process.env.FLOW_ADMIN_TOKEN,'x-entity-id':'izakhono-africa','x-platform-id':'runtime-selftest'}}).then(async r=>{const v=await r.json();if(!r.ok||v.scope?.entity_id!=='izakhono-africa'||v.scope?.platform_id!=='runtime-selftest')process.exit(1);process.stdout.write(JSON.stringify(v))}).catch(()=>process.exit(1))")"
echo "$FLOW_AUTH_PROOF" | jq -e '.scope.entity_id == "izakhono-africa" and .scope.platform_id == "runtime-selftest"' >/dev/null

echo '[6/7] Proving FLOW durable volume backup + isolated restore...'
PERSISTENCE_PROOF="$("$SCRIPT_DIR/prove-flow-persistence.sh")"
echo "$PERSISTENCE_PROOF"
FLOW_BACKUP="$(printf '%s\n' "$PERSISTENCE_PROOF" | sed -n 's/^FLOW_BACKUP=//p' | tail -1)"
[ -n "$FLOW_BACKUP" ] || { echo '[FAIL] FLOW backup evidence path was not returned.'; exit 1; }

echo '[7/7] Recording owned runtime evidence...'
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo local-source)"
CRM_IMAGE="$(docker inspect -f '{{.Image}}' izakhono-crm)"
FLOW_IMAGE="$(docker inspect -f '{{.Image}}' izakhono-flow)"
FABRIC_IMAGE="$(docker inspect -f '{{.Image}}' izakhono-app-fabric-gateway)"
PUBLIC_ENABLED="$(docker exec izakhono-app-fabric-gateway node -e "fetch('http://127.0.0.1:8090/health').then(r=>r.json()).then(v=>process.stdout.write(String(v.public_intake))).catch(()=>process.exit(1))")"

jq -n \
  --arg schema 'izakhono.app-fabric.node01.report.v2' \
  --arg generated "$STARTED" \
  --arg commit "$COMMIT" \
  --arg crm_state "$CRM_STATE" \
  --arg flow_state "$FLOW_STATE" \
  --arg fabric_state "$FABRIC_STATE" \
  --arg crm_image "$CRM_IMAGE" \
  --arg flow_image "$FLOW_IMAGE" \
  --arg fabric_image "$FABRIC_IMAGE" \
  --arg flow_backup "$FLOW_BACKUP" \
  --argjson public_intake "$PUBLIC_ENABLED" \
  '{
    schema:$schema,
    generated_at:$generated,
    git_commit:$commit,
    overall:"PASS_INTERNAL_OWNED",
    crm:{health:$crm_state,image:$crm_image,network_exposure:"private-docker-network-only"},
    flow:{
      health:$flow_state,
      image:$flow_image,
      engine_independent:true,
      auth_proof:"PASS_OWNER_SCOPED_READ",
      privacy_proof:"PASS_HEALTH_NO_TRACKING",
      network_exposure:"private-docker-network-only"
    },
    fabric:{health:$fabric_state,image:$fabric_image,network_exposure:"shared-docker-network-for-caddy-only",public_intake:$public_intake},
    integration:{gateway_to_crm:"PASS_NON_WRITING",flow_super_app_bridge:"PENDING_IZAKHONO_ONE_NODE01_START"},
    secrets:{location:"/opt/izakhono/secrets/app-fabric-runtime.env",mode:"owner-only",values_exported:false},
    persistence:{
      crm_volume:"izakhono_crm_data",
      flow_volume:"izakhono_flow_data",
      outbox_volume:"izakhono_fabric_outbox",
      flow_backup_restore:"PASS_ISOLATED_RESTORE",
      flow_backup:$flow_backup
    },
    public_cutover_performed:false,
    public_status:"NOT_YET_VERIFIED",
    next_gate:"start IZAKHONO ONE with FLOW bridge + configure approved internal adapters + EDGE/TLS only where required"
  }' > "$REPORT"
chmod 600 "$REPORT"

echo
echo '[PASS] IZAKHONO APP FABRIC + FLOW internal owned runtime is healthy.'
echo "Evidence: $REPORT"
echo '[NEXT] Run RUN-IZAKHONO-ONE-NODE01.cmd to prove the SUPER APP -> FLOW internal bridge.'
echo '[HOLD] Public activation remains a separate DNS / EDGE / allowed-origin gate.'
