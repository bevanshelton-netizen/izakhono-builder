#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  python3 - <<'PY'
from pathlib import Path
import secrets
p=Path('.env')
s=p.read_text()
s=s.replace('replace-with-a-long-random-token', secrets.token_urlsafe(48), 1)  # HOST_RUNTIME_TOKEN
s=s.replace('replace-with-a-long-random-token', secrets.token_urlsafe(48), 1)  # JARVIS_OWNER_SECRET
s=s.replace('replace-with-a-long-random-token', secrets.token_urlsafe(48), 1)  # JARVIS_WORKER_TOKEN
s=s.replace('replace-with-a-long-random-password', secrets.token_urlsafe(32), 1)  # POSTGRES_PASSWORD
s=s.replace('replace-with-a-long-random-password', secrets.token_urlsafe(32), 1)  # MINIO_ROOT_PASSWORD
p.write_text(s)
PY
  chmod 600 .env
  echo "Created .env with locally generated runtime secrets. Set TLS_EMAIL and review mail settings before public activation."
fi

# Upgrade existing NODE01 .env files created before J.A.R.V.I.S. was added.
# Missing or example-value J.A.R.V.I.S. secrets are generated locally and never printed.
python3 - <<'PY'
from pathlib import Path
import secrets
p = Path('.env')
lines = p.read_text().splitlines()
for key in ('JARVIS_OWNER_SECRET', 'JARVIS_WORKER_TOKEN'):
    found = False
    for index, line in enumerate(lines):
        if line.startswith(key + '='):
            found = True
            if not line.split('=', 1)[1] or 'replace-with' in line:
                lines[index] = key + '=' + secrets.token_urlsafe(48)
            break
    if not found:
        lines.append(key + '=' + secrets.token_urlsafe(48))
p.write_text('\\n'.join(lines) + '\\n')
PY
chmod 600 .env

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi

for key in HOST_RUNTIME_TOKEN JARVIS_OWNER_SECRET JARVIS_WORKER_TOKEN POSTGRES_PASSWORD MINIO_ROOT_PASSWORD; do
  if ! grep -q "^${key}=." .env || grep -q "^${key}=replace-with" .env; then
    echo "Required secret $key is missing or still a placeholder." >&2
    exit 1
  fi
done

echo "[1/6] Validating compose"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null

echo "[2/6] Building owned services"
docker compose --env-file .env -f docker-compose.owned.yml build --pull host-runtime jarvis-api contact-gateway mail-bridge

echo "[3/6] Starting PostgreSQL"
docker compose --env-file .env -f docker-compose.owned.yml up -d postgres
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T postgres pg_isready -U "$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)" -d "$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" == 30 ]]; then
    echo "PostgreSQL did not become ready; inspect postgres logs." >&2
    exit 1
  fi
  sleep 2
done

echo "[4/6] Applying explicit J.A.R.V.I.S. schema migration"
docker compose --env-file .env -f docker-compose.owned.yml run --rm --no-deps -e JARVIS_ALLOW_SCHEMA_MIGRATION=1 jarvis-api npm run migrate

echo "[5/6] Starting owned services"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[6/6] Waiting for HOST and J.A.R.V.I.S. health"
for i in {1..45}; do
  host_ok=0
  jarvis_ok=0
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then host_ok=1; fi
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T jarvis-api node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then jarvis_ok=1; fi
  if [[ "$host_ok" == 1 && "$jarvis_ok" == 1 ]]; then
    echo "IZAKHONO HOST and J.A.R.V.I.S. runtime are healthy."
    docker compose --env-file .env -f docker-compose.owned.yml ps
    exit 0
  fi
  sleep 2
done

echo "Owned services did not become healthy; inspect: docker compose -f docker-compose.owned.yml logs --tail=200 host-runtime jarvis-api postgres" >&2
exit 1
