#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${CONNECTA_COMPOSE_FILE:-$ROOT/docker-compose.owned.yml}"
PROJECT="${CONNECTA_COMPOSE_PROJECT:-izakhono-connecta}"
DEST_ROOT="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$DEST_ROOT/connecta-$STAMP"

mkdir -p "$DEST"
chmod 700 "$DEST"

DC=(docker compose -p "$PROJECT" -f "$COMPOSE_FILE")
"${DC[@]}" ps --status running postgres >/dev/null

echo "[1/4] PostgreSQL backup..."
"${DC[@]}" exec -T postgres   pg_dump -U connecta -d connecta -Fc --no-owner --no-acl > "$DEST/connecta-db.dump"

echo "[2/4] Media backup..."
HOST_UID="$(id -u)"
HOST_GID="$(id -g)"
docker run --rm \
  -e HOST_UID="$HOST_UID" \
  -e HOST_GID="$HOST_GID" \
  -v "${PROJECT}_connecta_media:/source:ro" \
  -v "$DEST:/backup" \
  postgres:17-alpine \
  sh -lc 'cd /source && tar -czf /backup/connecta-media.tar.gz . && chown "$HOST_UID:$HOST_GID" /backup/connecta-media.tar.gz'

MEDIA_FILES="$(docker run --rm -v "${PROJECT}_connecta_media:/source:ro" postgres:17-alpine sh -lc 'find /source -type f | wc -l' | tr -d '[:space:]')"
DB_BYTES="$(wc -c < "$DEST/connecta-db.dump" | tr -d '[:space:]')"
MEDIA_BYTES="$(wc -c < "$DEST/connecta-media.tar.gz" | tr -d '[:space:]')"
COMMIT="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || printf unknown)"

echo "[3/4] Integrity manifest..."
(
  cd "$DEST"
  sha256sum connecta-db.dump connecta-media.tar.gz > SHA256SUMS
)

cat > "$DEST/manifest.json" <<JSON
{
  "schema": "connecta.backup.v1",
  "created_at_utc": "$STAMP",
  "source_commit": "$COMMIT",
  "compose_project": "$PROJECT",
  "database": "connecta",
  "database_dump_format": "postgres-custom",
  "database_bytes": $DB_BYTES,
  "media_file_count": ${MEDIA_FILES:-0},
  "media_bytes": $MEDIA_BYTES,
  "contains_secrets": false
}
JSON
chmod 600 "$DEST/connecta-db.dump" "$DEST/connecta-media.tar.gz" "$DEST/SHA256SUMS" "$DEST/manifest.json"

echo "[4/4] Verifying checksums..."
(cd "$DEST" && sha256sum -c SHA256SUMS)

printf '%s\n' "$DEST"
