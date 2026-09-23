#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${CONNECTA_COMPOSE_FILE:-$ROOT/docker-compose.owned.yml}"
PROJECT="${CONNECTA_COMPOSE_PROJECT:-izakhono-connecta}"
BACKUP_DIR="${1:?Usage: restore-test.sh /path/to/connecta-backup}"
RESTORE_DB="connecta_restore_test_${RANDOM}_$$"
TEST_VOLUME="${PROJECT}_restore_test_${RANDOM}_$$"

for f in manifest.json SHA256SUMS connecta-db.dump connecta-media.tar.gz; do
  [[ -f "$BACKUP_DIR/$f" ]] || { echo "missing-backup-file:$f" >&2; exit 20; }
done

(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)

DC=(docker compose -p "$PROJECT" -f "$COMPOSE_FILE")
"${DC[@]}" ps --status running postgres >/dev/null

cleanup() {
  "${DC[@]}" exec -T postgres dropdb -U connecta --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
  docker volume rm -f "$TEST_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[1/4] Restoring PostgreSQL into temporary database..."
"${DC[@]}" exec -T postgres createdb -U connecta "$RESTORE_DB"
cat "$BACKUP_DIR/connecta-db.dump" | "${DC[@]}" exec -T postgres   pg_restore -U connecta -d "$RESTORE_DB" --no-owner --no-acl

TABLE_COUNT="$("${DC[@]}" exec -T postgres psql -U connecta -d "$RESTORE_DB" -Atc   "select count(*) from information_schema.tables where table_schema='public';" | tr -d '[:space:]')"
[[ "${TABLE_COUNT:-0}" -ge 20 ]] || { echo "restore-test-too-few-tables:$TABLE_COUNT" >&2; exit 21; }

echo "[2/4] Validating restored CONNECTA schema..."
for table in accounts profiles posts media_assets moderation_cases businesses notifications; do
  FOUND="$("${DC[@]}" exec -T postgres psql -U connecta -d "$RESTORE_DB" -Atc     "select count(*) from information_schema.tables where table_schema='public' and table_name='$table';" | tr -d '[:space:]')"
  [[ "$FOUND" == "1" ]] || { echo "restore-test-missing-table:$table" >&2; exit 22; }
done

echo "[3/4] Restoring media into temporary volume..."
docker volume create "$TEST_VOLUME" >/dev/null
docker run --rm   -v "$TEST_VOLUME:/restore"   -v "$BACKUP_DIR:/backup:ro"   postgres:17-alpine   sh -lc 'cd /restore && tar -xzf /backup/connecta-media.tar.gz'

EXPECTED_MEDIA="$(python3 - "$BACKUP_DIR/manifest.json" <<'PY'
import json,sys
with open(sys.argv[1], encoding="utf-8") as f:
    print(int(json.load(f).get("media_file_count", 0)))
PY
)"
ACTUAL_MEDIA="$(docker run --rm -v "$TEST_VOLUME:/restore:ro" postgres:17-alpine sh -lc 'find /restore -type f | wc -l' | tr -d '[:space:]')"
[[ "$ACTUAL_MEDIA" == "$EXPECTED_MEDIA" ]] || {
  echo "restore-test-media-count-mismatch:expected=$EXPECTED_MEDIA actual=$ACTUAL_MEDIA" >&2
  exit 23
}

echo "[4/4] Recovery proof passed."
printf '{"ok":true,"database_tables":%s,"media_files":%s,"destructive":false}\n' "$TABLE_COUNT" "$ACTUAL_MEDIA"
