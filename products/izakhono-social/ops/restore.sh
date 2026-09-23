#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${CONNECTA_COMPOSE_FILE:-$ROOT/docker-compose.owned.yml}"
PROJECT="${CONNECTA_COMPOSE_PROJECT:-izakhono-connecta}"
BACKUP_DIR="${1:?Usage: restore.sh /path/to/connecta-backup --confirm-destructive}"
CONFIRM="${2:-}"

[[ "$CONFIRM" == "--confirm-destructive" ]] || {
  echo "STOP: production restore is destructive. Re-run with --confirm-destructive." >&2
  exit 30
}

for f in manifest.json SHA256SUMS connecta-db.dump connecta-media.tar.gz; do
  [[ -f "$BACKUP_DIR/$f" ]] || { echo "missing-backup-file:$f" >&2; exit 31; }
done
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)

DC=(docker compose -p "$PROJECT" -f "$COMPOSE_FILE")

echo "[1/6] Stopping CONNECTA web and engine..."
"${DC[@]}" stop web engine

rollback_start() {
  "${DC[@]}" up -d postgres engine web >/dev/null 2>&1 || true
}
trap rollback_start EXIT

echo "[2/6] Recreating database..."
"${DC[@]}" exec -T postgres psql -U connecta -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname='connecta' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS connecta;
CREATE DATABASE connecta OWNER connecta;
SQL

echo "[3/6] Restoring PostgreSQL..."
cat "$BACKUP_DIR/connecta-db.dump" | "${DC[@]}" exec -T postgres   pg_restore -U connecta -d connecta --no-owner --no-acl

echo "[4/6] Restoring media volume..."
docker run --rm -v "${PROJECT}_connecta_media:/restore" postgres:17-alpine   sh -lc 'find /restore -mindepth 1 -delete'
docker run --rm   -v "${PROJECT}_connecta_media:/restore"   -v "$BACKUP_DIR:/backup:ro"   postgres:17-alpine   sh -lc 'cd /restore && tar -xzf /backup/connecta-media.tar.gz'

echo "[5/6] Starting CONNECTA..."
"${DC[@]}" up -d postgres engine web

echo "[6/6] Waiting for full-stack health..."
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 http://127.0.0.1:"${CONNECTA_PORT:-3080}"/health >/dev/null; then
    trap - EXIT
    echo '{"ok":true,"restored":true,"health":"passed"}'
    exit 0
  fi
  sleep 2
done

echo "restore-health-check-failed" >&2
exit 32
