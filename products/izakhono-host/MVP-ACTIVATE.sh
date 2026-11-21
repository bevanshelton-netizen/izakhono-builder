#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
ENV_FILE=".env.mvp"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.mvp.yml)

command -v docker >/dev/null 2>&1 || { echo "Docker Engine is required." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required." >&2; exit 1; }
[[ ! -e "$ENV_FILE" ]] || { echo "$ENV_FILE already exists; refusing to overwrite secrets." >&2; exit 1; }

python3 - <<'PY'
from pathlib import Path
import secrets
values = {
 "POSTGRES_DB": "izakhono",
 "POSTGRES_USER": "izakhono",
 "POSTGRES_PASSWORD": secrets.token_urlsafe(36),
 "COMPUTE_ADMIN_TOKEN": secrets.token_urlsafe(48),
 "COMPUTE_WORKER_ID": "izakhono-worker-01",
 "COMPUTE_WORKER_ENROLLMENT_TOKEN": "",
 "HOST_RUNTIME_TOKEN": secrets.token_urlsafe(48),
}
Path(".env.mvp").write_text("\n".join(f"{k}={v}" for k,v in values.items())+"\n")
PY
chmod 600 "$ENV_FILE"
trap 'echo "Activation interrupted. Inspect: ${COMPOSE[*]} ps and logs."' ERR

echo "[1/6] Validate private MVP stack"
"${COMPOSE[@]}" config --quiet

echo "[2/6] Build only the MVP services"
"${COMPOSE[@]}" build --pull compute-manager compute-worker host-runtime

echo "[3/6] Start PostgreSQL and compute manager"
"${COMPOSE[@]}" up -d postgres compute-manager
healthy=0
for _ in {1..60}; do
  if "${COMPOSE[@]}" exec -T compute-manager node -e "fetch('http://127.0.0.1:8082/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" == 1 ]] || { "${COMPOSE[@]}" logs --tail=100 postgres compute-manager; echo "Manager health gate failed." >&2; exit 1; }

echo "[4/6] Issue single-use worker enrollment"
ADMIN_TOKEN="$(sed -n 's/^COMPUTE_ADMIN_TOKEN=//p' "$ENV_FILE")"
WORKER_ID="$(sed -n 's/^COMPUTE_WORKER_ID=//p' "$ENV_FILE")"
ENROLLMENT_TOKEN="$("${COMPOSE[@]}" exec -T -e WORKER_ID="$WORKER_ID" compute-manager node -e 'fetch("http://127.0.0.1:8082/api/compute/nodes/enroll",{method:"POST",headers:{authorization:"Bearer "+process.env.COMPUTE_ADMIN_TOKEN,"content-type":"application/json"},body:JSON.stringify({worker_id:process.env.WORKER_ID})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||r.status);process.stdout.write(d.enrollment_token)}).catch(e=>{console.error(e.message);process.exit(1)})' )"
[[ -n "$ENROLLMENT_TOKEN" ]] || { echo "Enrollment token was not issued." >&2; exit 1; }
python3 - "$ENV_FILE" "$ENROLLMENT_TOKEN" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); lines=p.read_text().splitlines()
lines=[f"COMPUTE_WORKER_ENROLLMENT_TOKEN={sys.argv[2]}" if x.startswith("COMPUTE_WORKER_ENROLLMENT_TOKEN=") else x for x in lines]
p.write_text("\n".join(lines)+"\n")
PY
chmod 600 "$ENV_FILE"

echo "[5/6] Enrol worker and verify online state"
"${COMPOSE[@]}" up -d compute-worker
registered=0
for _ in {1..45}; do
  if "${COMPOSE[@]}" exec -T -e WORKER_ID="$WORKER_ID" compute-manager node -e 'fetch("http://127.0.0.1:8082/api/compute/nodes",{headers:{authorization:"Bearer "+process.env.COMPUTE_ADMIN_TOKEN}}).then(async r=>{const d=await r.json();process.exit(r.ok&&d.nodes?.some(n=>n.id===process.env.WORKER_ID&&n.status==="online")?0:1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then registered=1; break; fi
  sleep 2
done
[[ "$registered" == 1 ]] || { "${COMPOSE[@]}" logs --tail=100 compute-worker compute-manager; echo "Worker did not enroll." >&2; exit 1; }

echo "[6/6] Start owned site runtime and verify local health"
"${COMPOSE[@]}" up -d host-runtime
runtime_ok=0
for _ in {1..45}; do
  if curl --fail --silent http://127.0.0.1:18080/health >/dev/null; then runtime_ok=1; break; fi
  sleep 2
done
[[ "$runtime_ok" == 1 ]] || { "${COMPOSE[@]}" logs --tail=100 host-runtime; echo "Host runtime health gate failed." >&2; exit 1; }

# Remove the one-time enrollment secret from the environment file; the worker
# retains its unique credential in its private named volume.
python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
lines=[x.split("=",1)[0]+"=" if x.startswith("COMPUTE_WORKER_ENROLLMENT_TOKEN=") else x for x in p.read_text().splitlines()]
p.write_text("\n".join(lines)+"\n")
PY
chmod 600 "$ENV_FILE"
"${COMPOSE[@]}" up -d --no-deps compute-worker
"${COMPOSE[@]}" ps

echo
echo "IZAKHONO HOST PRIVATE MVP: HEALTH CHECKS PASSED"
echo "Local runtime health: http://127.0.0.1:18080/health"
echo "No public ports are exposed. Manager and worker remain on the private Docker network."
echo "Secrets are in $ENV_FILE (mode 0600); back up securely and never commit it."
echo "This is a private single-node MVP, not a public customer production launch."
