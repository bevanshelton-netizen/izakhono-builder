#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SNAPSHOT_ID="${1:-}"
[[ -n "$SNAPSHOT_ID" ]] || { echo "Usage: ./restore-owned.sh <restic-snapshot-id>" >&2; exit 1; }
[[ -f .env && -f .backup.env ]] || { echo ".env and .backup.env are required." >&2; exit 2; }

set -a
. ./.env
. ./.backup.env
set +a
: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"
command -v docker >/dev/null
command -v restic >/dev/null

read -r -p "This replaces host runtime, Caddy, MinIO, Valkey, mail-control-plane and PostgreSQL state. Type RESTORE HOST: " CONFIRM
[[ "$CONFIRM" == "RESTORE HOST" ]] || { echo "Restore cancelled."; exit 3; }

RESTORE_ROOT="$(mktemp -d /var/tmp/izakhono-host-restore.XXXXXX)"
STAGE_DIR="$RESTORE_ROOT/stage"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PRE_RESTORE_DIR="$ROOT/backups/pre-restore-$STAMP"
ARTIFACT_DIR="$ROOT/backups/restored-artifacts-$STAMP"
mkdir -p "$STAGE_DIR" "$PRE_RESTORE_DIR" "$ARTIFACT_DIR"
chmod 700 "$RESTORE_ROOT" "$STAGE_DIR" "$PRE_RESTORE_DIR" "$ARTIFACT_DIR"
trap 'rm -rf "$RESTORE_ROOT"' EXIT

restic restore "$SNAPSHOT_ID" --target "$RESTORE_ROOT"
ARCHIVE="$(find "$RESTORE_ROOT" -type f -name 'izakhono-host-*.tar.gz' | head -n1)"
[[ -n "$ARCHIVE" ]] || { echo "Host archive not found in selected snapshot." >&2; exit 4; }
CHECKSUM="$ARCHIVE.sha256"
[[ -f "$CHECKSUM" ]] || { echo "Host archive checksum is missing." >&2; exit 5; }
EXPECTED="$(awk '{print $1}' "$CHECKSUM")"
ACTUAL="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo "Host archive checksum mismatch." >&2; exit 6; }

tar -xzf "$ARCHIVE" -C "$STAGE_DIR"
for required in host-runtime-data.tar.gz caddy-data.tar.gz caddy-config.tar.gz minio-data.tar.gz valkey-data.tar.gz mail-control-plane-state.tar.gz izakhono-postgres.dump roundcube-postgres.dump; do
  [[ -f "$STAGE_DIR/$required" ]] || { echo "Required restore component missing: $required" >&2; exit 7; }
done

backup_volume() {
  local volume="$1" filename="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || return 0
  docker run --rm --network none -v "$volume:/source:ro" -v "$PRE_RESTORE_DIR:/backup" alpine:3.21 sh -c "tar czf /backup/$filename -C /source ."
}

restore_volume() {
  local volume="$1" archive="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
  docker run --rm --network none -v "$volume:/target" -v "$STAGE_DIR/$archive:/backup.tar.gz:ro" alpine:3.21 sh -c "find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar xzf /backup.tar.gz -C /target"
}

echo "[1/5] Create pre-restore volume and database safety copies"
backup_volume "izakhono-host_host-runtime-data" "host-runtime-data.tar.gz"
backup_volume "izakhono-host_caddy-data" "caddy-data.tar.gz"
backup_volume "izakhono-host_caddy-config" "caddy-config.tar.gz"
backup_volume "izakhono-host_minio-data" "minio-data.tar.gz"
backup_volume "izakhono-host_valkey-data" "valkey-data.tar.gz"
backup_volume "izakhono-host_mail-control-plane-state" "mail-control-plane-state.tar.gz"
docker compose --env-file .env -f docker-compose.owned.yml up -d postgres roundcube-db
docker compose --env-file .env -f docker-compose.owned.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$PRE_RESTORE_DIR/current-izakhono-postgres.dump"
docker compose --env-file .env -f docker-compose.owned.yml exec -T roundcube-db sh -c 'PGPASSWORD="$(cat /run/secrets/roundcube_db_password)" pg_dump -U roundcube -d roundcube -Fc' > "$PRE_RESTORE_DIR/current-roundcube-postgres.dump"

echo "[2/5] Stop mutable host services"
docker compose --env-file .env -f docker-compose.owned.yml stop host-runtime mail-control-plane edge minio valkey roundcube

echo "[3/5] Restore persistent runtime volumes"
restore_volume "izakhono-host_host-runtime-data" "host-runtime-data.tar.gz"
restore_volume "izakhono-host_caddy-data" "caddy-data.tar.gz"
restore_volume "izakhono-host_caddy-config" "caddy-config.tar.gz"
restore_volume "izakhono-host_minio-data" "minio-data.tar.gz"
restore_volume "izakhono-host_valkey-data" "valkey-data.tar.gz"
restore_volume "izakhono-host_mail-control-plane-state" "mail-control-plane-state.tar.gz"

echo "[4/5] Restore PostgreSQL databases"
cat "$STAGE_DIR/izakhono-postgres.dump" | docker compose --env-file .env -f docker-compose.owned.yml exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error
cat "$STAGE_DIR/roundcube-postgres.dump" | docker compose --env-file .env -f docker-compose.owned.yml exec -T roundcube-db sh -c 'PGPASSWORD="$(cat /run/secrets/roundcube_db_password)" pg_restore -U roundcube -d roundcube --clean --if-exists --no-owner --exit-on-error'

echo "[5/5] Restore missing owner secrets, preserve recovered configuration and restart host services"
cp -a "$STAGE_DIR/." "$ARTIFACT_DIR/"
chmod -R go-rwx "$ARTIFACT_DIR"

# Restore missing secrets only; never overwrite credentials that already exist on the node.
if [[ -d "$STAGE_DIR/host-secrets" ]]; then
  mkdir -p host/secrets
  for item in "$STAGE_DIR/host-secrets"/*; do
    [[ -e "$item" ]] || continue
    target="host/secrets/$(basename "$item")"
    [[ -e "$target" ]] || cp -a "$item" "$target"
  done
  chmod -R go-rwx host/secrets
fi
if [[ -d "$STAGE_DIR/mail-secrets" ]]; then
  mkdir -p mail/secrets
  for item in "$STAGE_DIR/mail-secrets"/*; do
    [[ -e "$item" ]] || continue
    target="mail/secrets/$(basename "$item")"
    [[ -e "$target" ]] || cp -a "$item" "$target"
  done
  chmod -R go-rwx mail/secrets
fi

docker compose --env-file .env -f docker-compose.owned.yml up -d

CID="$(docker compose --env-file .env -f docker-compose.owned.yml ps -q host-runtime)"
[[ -n "$CID" ]] || { echo "Host runtime container was not created." >&2; exit 8; }
for attempt in $(seq 1 30); do
  HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$CID" 2>/dev/null || true)"
  [[ "$HEALTH" == "healthy" ]] && break
  [[ "$attempt" -lt 30 ]] || { echo "Host runtime did not become healthy after restore." >&2; exit 9; }
  sleep 3
done

echo "Host state restored. Recovery artifacts: $ARTIFACT_DIR"
echo "Pre-restore safety copies: $PRE_RESTORE_DIR"
echo "Review recovered host.env and mail-secrets against current credentials."
echo "Restore Stalwart separately with mail/restore-mail-node.sh if mail data is also being recovered."
echo "Run hosting, mail, DNS, TLS and real send/receive acceptance tests before returning services to production."
