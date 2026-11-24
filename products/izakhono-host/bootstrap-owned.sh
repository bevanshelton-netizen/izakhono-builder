#!/usr/bin/env bash
set -Eeuo pipefail
# Runtime secrets must never inherit a permissive shell umask.
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required" >&2; exit 1; }

if [[ -L .env ]]; then
  echo ".env must be a regular file, not a symlink." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  python3 - <<'PY'
from pathlib import Path
import os
import secrets
p = Path('.env')
s = p.read_text()
# Generate only secrets owned by this HOST runtime. Mailbox credentials and
# TLS contact details remain operator-supplied values.
s = s.replace('replace-with-a-long-random-token', secrets.token_urlsafe(48), 1)
s = s.replace('replace-with-a-long-random-token', secrets.token_urlsafe(48), 1)
s = s.replace('replace-with-a-long-random-password', secrets.token_urlsafe(32), 1)
s = s.replace('replace-with-a-long-random-password', secrets.token_urlsafe(32), 1)
p.write_text(s)
os.chmod(p, 0o600)
PY
  echo "Created .env with HOST-owned secrets. Set SMTP credentials and TLS_EMAIL before activation."
fi

# Enforce private permissions even when an operator supplied an existing file.
chmod 600 .env
if [[ "$(stat -c '%a' .env)" != "600" ]]; then
  echo ".env permissions must be exactly 600." >&2
  exit 1
fi

if grep -q 'ops@example.com' .env; then
  echo "Set TLS_EMAIL in .env before public HTTPS activation." >&2
  exit 1
fi
if grep -q '^SMTP_USER=info@example.com

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
 .env || grep -q '^SMTP_PASS=replace-with-' .env; then
  echo "Set the real SMTP_USER and SMTP_PASS through the approved host secret process." >&2
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
