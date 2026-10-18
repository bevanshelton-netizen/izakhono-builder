#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"

printf 'IZAKHONO BACKUP VERIFICATION — %s\n' "$STAMP"

# Capture the owned runtime state from the named Docker volume.
docker run --rm \
  -v izakhono-host_host-runtime-data:/source:ro \
  -v "$OUT":/backup \
  alpine:3.20 sh -c 'tar -czf /backup/runtime-state.tgz -C /source .'

# Capture PostgreSQL through pg_dump when the compose stack is running.
if docker compose --env-file .env -f docker-compose.owned.yml ps --status running postgres >/dev/null 2>&1; then
  docker compose --env-file .env -f docker-compose.owned.yml exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-izakhono}" -d "${POSTGRES_DB:-izakhono}" > "$OUT/postgres.sql"
else
  echo 'PostgreSQL container is not running; database dump was not produced.' >&2
  exit 2
fi

# Integrity check and manifest.
test -s "$OUT/runtime-state.tgz"
test -s "$OUT/postgres.sql"
sha256sum "$OUT/runtime-state.tgz" "$OUT/postgres.sql" > "$OUT/SHA256SUMS"

printf 'Backup verification passed: %s\n' "$OUT"
cat "$OUT/SHA256SUMS"
