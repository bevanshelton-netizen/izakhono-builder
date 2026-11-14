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

echo "[1/4] Validating private compute stack"
docker compose --env-file .env -f docker-compose.owned.yml config --quiet

echo "[2/4] Building compute manager and worker"
docker compose --env-file .env -f docker-compose.owned.yml build --pull compute-manager compute-worker

echo "[3/4] Starting PostgreSQL and private compute services"
docker compose --env-file .env -f docker-compose.owned.yml up -d postgres compute-manager compute-worker

echo "[4/4] Waiting for manager health and worker registration"
healthy=0
for i in {1..60}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T compute-manager node -e "fetch('http://127.0.0.1:8082/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done
if [[ "$healthy" != "1" ]]; then
  echo "Compute manager did not become healthy." >&2
  docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 compute-manager postgres
  exit 1
fi

registered=0
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T compute-manager node -e "fetch('http://127.0.0.1:8082/api/compute/nodes',{headers:{authorization:'Bearer '+process.env.COMPUTE_ADMIN_TOKEN}}).then(async r=>{const d=await r.json();process.exit(r.ok&&d.nodes?.some(n=>n.status==='online')?0:1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    registered=1
    break
  fi
  sleep 2
done
if [[ "$registered" != "1" ]]; then
  echo "No compute worker registered. Inspect: docker compose logs compute-worker compute-manager" >&2
  exit 1
fi

docker compose --env-file .env -f docker-compose.owned.yml ps postgres compute-manager compute-worker
echo
echo "IZAKHONO PRIVATE COMPUTE FABRIC: ONLINE"
echo "Manager and worker are private to the Docker network; no public port was opened."
echo "Use an authenticated SSH tunnel or private admin gateway for operator access."
