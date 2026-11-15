#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created local .env from the template."
fi
python3 ./generate-env-secrets.py
chmod 600 .env
WORKER_ID="${COMPUTE_WORKER_ID:-izakhono-worker-01}"
[[ "$WORKER_ID" =~ ^[-a-zA-Z0-9_.]{3,80}$ ]] || { echo "Invalid COMPUTE_WORKER_ID" >&2; exit 1; }

echo "[1/5] Validating private compute stack"
docker compose --env-file .env -f docker-compose.owned.yml config --quiet

echo "[2/5] Building compute manager and worker"
docker compose --env-file .env -f docker-compose.owned.yml build --pull compute-manager compute-worker

echo "[3/5] Starting PostgreSQL and private manager"
docker compose --env-file .env -f docker-compose.owned.yml up -d postgres compute-manager
healthy=0
for i in {1..60}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T compute-manager node -e "fetch('http://127.0.0.1:8082/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
if [[ "$healthy" != "1" ]]; then
  echo "Compute manager did not become healthy." >&2
  docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 compute-manager postgres
  exit 1
fi

echo "[4/5] Issuing one-time enrollment for this worker"
ENROLLMENT_TOKEN="$(docker compose --env-file .env -f docker-compose.owned.yml exec -T -e WORKER_ID="$WORKER_ID" compute-manager node -e "const id=process.env.WORKER_ID;fetch('http://127.0.0.1:8082/api/compute/nodes/enroll',{method:'POST',headers:{authorization:'Bearer '+process.env.COMPUTE_ADMIN_TOKEN,'content-type':'application/json'},body:JSON.stringify({worker_id:id})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||r.status);process.stdout.write(d.enrollment_token)}).catch(e=>{console.error(e.message);process.exit(1)})")"
[[ -n "$ENROLLMENT_TOKEN" ]] || { echo "Could not obtain worker enrollment token." >&2; exit 1; }
COMPUTE_WORKER_ENROLLMENT_TOKEN="$ENROLLMENT_TOKEN" python3 - <<'PY'
from pathlib import Path
import os
p=Path('.env')
lines=p.read_text().splitlines()
key='COMPUTE_WORKER_ENROLLMENT_TOKEN'
value=os.environ[key]
found=False
for i,line in enumerate(lines):
    if line.startswith(key+'='):
        lines[i]=key+'='+value
        found=True
if not found:
    lines.append(key+'='+value)
p.write_text('\n'.join(lines)+'\n')
PY
docker compose --env-file .env -f docker-compose.owned.yml up -d compute-worker

registered=0
for i in {1..45}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T compute-manager node -e "fetch('http://127.0.0.1:8082/api/compute/nodes',{headers:{authorization:'Bearer '+process.env.COMPUTE_ADMIN_TOKEN}}).then(async r=>{const d=await r.json();process.exit(r.ok&&d.nodes?.some(n=>n.id==='$WORKER_ID'&&n.status==='online')?0:1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then registered=1; break; fi
  sleep 2
done
if [[ "$registered" != "1" ]]; then
  echo "Worker enrollment failed. Inspect: docker compose logs compute-worker compute-manager" >&2
  exit 1
fi

echo "[5/5] Removing consumed enrollment token from runtime configuration"
python3 - <<'PY'
from pathlib import Path
p=Path('.env')
lines=p.read_text().splitlines()
lines=[line.split('=',1)[0]+'=' if line.startswith('COMPUTE_WORKER_ENROLLMENT_TOKEN=') else line for line in lines]
p.write_text('\n'.join(lines)+'\n')
PY
docker compose --env-file .env -f docker-compose.owned.yml up -d --no-deps compute-worker
chmod 600 .env
docker compose --env-file .env -f docker-compose.owned.yml ps postgres compute-manager compute-worker

echo
echo "IZAKHONO PRIVATE COMPUTE FABRIC: ONLINE"
echo "Worker has a unique persisted credential; its one-time enrollment token was consumed."
echo "Manager and worker remain private to the Docker network; no public port was opened."
echo "Use an authenticated SSH tunnel or private admin gateway for operator access."
