#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

[[ -f .env ]] || { echo ".env is required" >&2; exit 1; }
[[ -f .backup.env ]] || { echo ".backup.env is required; copy it from .backup.env.example" >&2; exit 2; }

set -a
. ./.env
. ./.backup.env
set +a

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"
command -v docker >/dev/null
command -v restic >/dev/null

if ! restic snapshots >/dev/null 2>&1; then
  echo "Restic repository is not initialized or credentials are invalid. Initialize it once with: restic init" >&2
  exit 3
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_ROOT="$(mktemp -d /var/tmp/izakhono-host-backup.XXXXXX)"
STAGE_DIR="$TMP_ROOT/stage"
ARCHIVE="$TMP_ROOT/izakhono-host-$STAMP.tar.gz"
mkdir -p "$STAGE_DIR"
chmod 700 "$TMP_ROOT" "$STAGE_DIR"

HOST_STOPPED=0
cleanup() {
  if [[ "$HOST_STOPPED" == "1" ]]; then
    docker compose --env-file .env -f docker-compose.owned.yml up -d >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

backup_volume() {
  local volume="$1"
  local filename="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || {
    echo "Required Docker volume is missing: $volume" >&2
    return 1
  }
  docker run --rm --network none -v "$volume:/source:ro" -v "$STAGE_DIR:/backup" alpine:3.21 sh -c "tar czf /backup/$filename -C /source ."
}

echo "[1/6] Check persistent services and save Valkey"
docker compose --env-file .env -f docker-compose.owned.yml ps
docker compose --env-file .env -f docker-compose.owned.yml exec -T valkey valkey-cli SAVE >/dev/null

echo "[2/6] Pause mutable host services for consistent volume snapshots"
HOST_STOPPED=1
docker compose --env-file .env -f docker-compose.owned.yml stop host-runtime mail-control-plane edge minio valkey

echo "[3/6] Snapshot persistent Docker volumes"
backup_volume "izakhono-host_host-runtime-data" "host-runtime-data.tar.gz"
backup_volume "izakhono-host_caddy-data" "caddy-data.tar.gz"
backup_volume "izakhono-host_caddy-config" "caddy-config.tar.gz"
backup_volume "izakhono-host_minio-data" "minio-data.tar.gz"
backup_volume "izakhono-host_valkey-data" "valkey-data.tar.gz"
backup_volume "izakhono-host_mail-control-plane-state" "mail-control-plane-state.tar.gz"

echo "[4/6] Export PostgreSQL databases"
docker compose --env-file .env -f docker-compose.owned.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$STAGE_DIR/izakhono-postgres.dump"
docker compose --env-file .env -f docker-compose.owned.yml exec -T roundcube-db sh -c 'PGPASSWORD="$(cat /run/secrets/roundcube_db_password)" pg_dump -U roundcube -d roundcube -Fc' > "$STAGE_DIR/roundcube-postgres.dump"

echo "[5/6] Include recovery configuration and secrets"
cp .env "$STAGE_DIR/host.env"
cp docker-compose.owned.yml "$STAGE_DIR/docker-compose.owned.yml"
cp edge/Caddyfile "$STAGE_DIR/Caddyfile"
cp mail/docker-compose.mail.yml "$STAGE_DIR/docker-compose.mail.yml"
cp mail/portfolio-mailboxes.yml "$STAGE_DIR/portfolio-mailboxes.yml"
cp -a mail/mta-sts "$STAGE_DIR/mta-sts"
cp -a mail/secrets "$STAGE_DIR/mail-secrets"
if [[ -f mail/.env ]]; then cp mail/.env "$STAGE_DIR/mail-node.env"; fi

echo "[6/6] Encrypt and upload off-host Restic snapshot"
tar -czf "$ARCHIVE" -C "$STAGE_DIR" .
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
restic backup "$ARCHIVE" "$ARCHIVE.sha256" --tag izakhono-host
restic forget --tag izakhono-host --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
restic check --read-data-subset=1/20

echo "IZAKHONO HOST backup completed and encrypted off-host."
echo "A restore drill is still required before declaring backup recovery verified."
