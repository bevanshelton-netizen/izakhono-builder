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
lines=[]
for line in p.read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        if value.startswith('replace-with-'):
            value = secrets.token_urlsafe(48 if 'TOKEN' in key else 32)
            line = f'{key}={value}'
    lines.append(line)
p.write_text(chr(10).join(lines) + chr(10))
PY
  chmod 600 .env
  echo "Created .env with generated secrets. Set TLS_EMAIL and PUBLIC_EDGE_IPS before public verification."
fi
chmod 600 .env

if grep -q 'replace-with-' .env; then
  echo "Replace all secret placeholders in .env before activation." >&2
  exit 1
fi

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi

echo "[1/4] Validating compose"
docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null

echo "[2/4] Building owned runtime"
docker compose --env-file .env -f docker-compose.owned.yml build --pull host-runtime

echo "[3/4] Starting owned runtime"
docker compose --env-file .env -f docker-compose.owned.yml up -d

echo "[4/4] Waiting for health"
for i in {1..30}; do
  if docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "IZAKHONO HOST runtime is healthy."
    docker compose --env-file .env -f docker-compose.owned.yml ps
    exit 0
  fi
  sleep 2
done

echo "Runtime did not become healthy; inspect: docker compose -f docker-compose.owned.yml logs --tail=200" >&2
exit 1
