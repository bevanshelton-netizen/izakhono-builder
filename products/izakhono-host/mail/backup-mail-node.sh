#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  ENV_FILE="$ROOT/.env"
elif [[ -f "$HOST_ROOT/.env" ]]; then
  ENV_FILE="$HOST_ROOT/.env"
else
  echo "Mail environment file not found (expected mail/.env or host .env)." >&2
  exit 1
fi

if [[ -f .backup.env ]]; then
  BACKUP_ENV="$ROOT/.backup.env"
elif [[ -f "$HOST_ROOT/.backup.env" ]]; then
  BACKUP_ENV="$HOST_ROOT/.backup.env"
else
  echo "Restic credentials missing; copy .backup.env.example to .backup.env." >&2
  exit 2
fi

set -a
. "$ENV_FILE"
. "$BACKUP_ENV"
set +a

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"
command -v docker >/dev/null
command -v restic >/dev/null

if ! restic snapshots >/dev/null 2>&1; then
  echo "Restic repository is not initialized or credentials are invalid. Run restic init once." >&2
  exit 3
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_ROOT="$(mktemp -d /var/tmp/izakhono-mail-backup.XXXXXX)"
STAGE_DIR="$TMP_ROOT/stage"
ARCHIVE="$TMP_ROOT/izakhono-mail-$STAMP.tar.gz"
mkdir -p "$STAGE_DIR"
chmod 700 "$TMP_ROOT" "$STAGE_DIR"

MAIL_STOPPED=0
cleanup() {
  if [[ "$MAIL_STOPPED" == "1" ]]; then
    docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml start stalwart >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

backup_volume() {
  local volume="$1"
  local filename="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || {
    echo "Required Stalwart Docker volume is missing: $volume" >&2
    return 1
  }
  docker run --rm --network none -v "$volume:/source:ro" -v "$STAGE_DIR:/backup" alpine:3.21 sh -c "tar czf /backup/$filename -C /source ."
}

echo "[1/4] Confirm Stalwart is running"
CID="$(docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml ps -q stalwart)"
[[ -n "$CID" ]] || { echo "Stalwart container not found." >&2; exit 4; }

echo "[2/4] Stop Stalwart for a consistent offline snapshot"
MAIL_STOPPED=1
docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml stop stalwart

echo "[3/4] Snapshot Stalwart data and recovery configuration"
backup_volume "izakhono-stalwart-etc" "stalwart-etc.tar.gz"
backup_volume "izakhono-stalwart-data" "stalwart-data.tar.gz"
cp docker-compose.mail.yml "$STAGE_DIR/docker-compose.mail.yml"
cp README.md "$STAGE_DIR/mail-README.md"
cp MAIL-NODE-ACTIVATE.sh "$STAGE_DIR/MAIL-NODE-ACTIVATE.sh"
if [[ -f "$ENV_FILE" ]]; then cp "$ENV_FILE" "$STAGE_DIR/mail-node.env"; fi
if [[ -d secrets ]]; then cp -a secrets "$STAGE_DIR/mail-secrets"; fi

echo "[4/4] Encrypt and upload off-host Restic snapshot"
tar -czf "$ARCHIVE" -C "$STAGE_DIR" .
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
restic backup "$ARCHIVE" "$ARCHIVE.sha256" --tag izakhono-mail
restic forget --tag izakhono-mail --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
restic check --read-data-subset=1/20

echo "IZAKHONO MAIL backup completed and encrypted off-host."
echo "This is an offline backup and requires a brief mail-service maintenance window."
echo "A restore drill is still required before declaring recovery verified."
