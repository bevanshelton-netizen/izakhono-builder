#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }
[[ -f .env ]] || { echo "Missing .env. Transfer the node-specific enrollment file to worker-node/.env first." >&2; exit 1; }
set -a
source .env
set +a
[[ -n "${COMPUTE_MANAGER_URL:-}" && -n "${WORKER_ID:-}" && -n "${WORKER_ENROLLMENT_TOKEN:-}" ]] || { echo "COMPUTE_MANAGER_URL, WORKER_ID and WORKER_ENROLLMENT_TOKEN are required for first enrollment." >&2; exit 1; }
chmod 600 .env
echo "[1/3] Validate and build the non-root worker"
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml build --pull compute-worker
echo "[2/3] Start worker and wait for one-time enrollment"
docker compose -f docker-compose.yml up -d compute-worker
enrolled=0
for i in {1..45}; do
  if docker compose -f docker-compose.yml logs --no-color compute-worker 2>&1 | grep -q "enrolled and authenticated"; then enrolled=1; break; fi
  sleep 2
done
if [[ "$enrolled" != "1" ]]; then
  echo "Worker did not enroll. Inspect: docker compose -f docker-compose.yml logs compute-worker" >&2
  exit 1
fi
echo "[3/3] Remove consumed enrollment token from .env and recreate worker"
python3 - <<'PY'
from pathlib import Path
p=Path('.env')
lines=p.read_text().splitlines()
lines=[line.split('=',1)[0]+'=' if line.startswith('WORKER_ENROLLMENT_TOKEN=') else line for line in lines]
p.write_text('\n'.join(lines)+'\n')
PY
chmod 600 .env
docker compose -f docker-compose.yml up -d --no-deps compute-worker
docker compose -f docker-compose.yml ps compute-worker
echo "IZAKHONO REMOTE WORKER: ENROLLED"
echo "Credential is stored in its private persistent volume; no inbound ports were opened."
