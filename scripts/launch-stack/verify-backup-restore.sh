#!/usr/bin/env bash
set -euo pipefail

DIR="${1:-}"
[ -d "$DIR" ] && [ -f "$DIR/SHA256SUMS" ] && [ -f "$DIR/postgres-all.sql.gz" ] && [ -f "$DIR/core-storage.tgz" ] || {
  echo 'Usage: verify-backup-restore.sh <backup-directory>'
  exit 2
}

(
  cd "$DIR"
  sha256sum -c SHA256SUMS
)

tar -tzf "$DIR/core-storage.tgz" >/dev/null

NAME="izakhono-restore-test-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=restore-test-only postgres:17-alpine >/dev/null
for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$NAME" pg_isready -U postgres >/dev/null

gzip -dc "$DIR/postgres-all.sql.gz" | docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null
DB_COUNT="$(docker exec "$NAME" psql -U postgres -d postgres -Atc "select count(*) from pg_database where datistemplate=false;")"
[ "$DB_COUNT" -ge 1 ] || { echo 'Restored dump contains no databases.'; exit 1; }

CORE_TABLES="$(docker exec "$NAME" psql -U postgres -d izakhono -Atc "select count(*) from information_schema.tables where table_schema='public' and table_name like 'iz_core_%';" 2>/dev/null || echo 0)"
[ "$CORE_TABLES" -ge 7 ] || { echo 'Restored dump is missing the IZAKHONO Core schema.'; exit 1; }

echo "[PASS] Backup checksum, Core storage archive and isolated PostgreSQL restore rehearsal passed (${DB_COUNT} databases, ${CORE_TABLES} Core tables visible)."
