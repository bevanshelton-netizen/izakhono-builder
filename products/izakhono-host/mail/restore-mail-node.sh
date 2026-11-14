#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

SNAPSHOT_ID="${1:-}"
[[ -n "$SNAPSHOT_ID" ]] || { echo "Usage: ./restore-mail-node.sh <restic-snapshot-id>" >&2; exit 1; }

if [[ -f .env ]]; then ENV_FILE="$ROOT/.env"; elif [[ -f "$HOST_ROOT/.env" ]]; then ENV_FILE="$HOST_ROOT/.env"; else
  echo "Current mail environment file not found." >&2; exit 2
fi
if [[ -f .backup.env ]]; then BACKUP_ENV="$ROOT/.backup.env"; elif [[ -f "$HOST_ROOT/.backup.env" ]]; then BACKUP_ENV="$HOST_ROOT/.backup.env"; else
  echo "Restic credentials missing." >&2; exit 3
fi

set -a
. "$ENV_FILE"
. "$BACKUP_ENV"
set +a
: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"

echo "This will replace the current Stalwart data and configuration volumes."
read -r -p "Type RESTORE MAIL to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE MAIL" ]] || { echo "Restore cancelled."; exit 4; }

RESTORE_ROOT="$(mktemp -d /var/tmp/izakhono-mail-restore.XXXXXX)"
STAGE_DIR="$RESTORE_ROOT/stage"
PRE_RESTORE_DIR="$ROOT/backups/pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$STAGE_DIR" "$PRE_RESTORE_DIR"
chmod 700 "$RESTORE_ROOT" "$STAGE_DIR" "$PRE_RESTORE_DIR"
trap 'rm -rf "$RESTORE_ROOT"' EXIT

restic restore "$SNAPSHOT_ID" --target "$RESTORE_ROOT"
ARCHIVE="$(find "$RESTORE_ROOT" -type f -name 'izakhono-mail-*.tar.gz' | head -n1)"
[[ -n "$ARCHIVE" ]] || { echo "Mail archive not found in selected snapshot." >&2; exit 5; }
CHECKSUM="$ARCHIVE.sha256"
[[ -f "$CHECKSUM" ]] || { echo "Mail archive checksum file is missing." >&2; exit 6; }
EXPECTED="$(awk '{print $1}' "$CHECKSUM")"
ACTUAL="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo "Mail archive checksum mismatch." >&2; exit 7; }

tar -xzf "$ARCHIVE" -C "$STAGE_DIR"
[[ -f "$STAGE_DIR/stalwart-etc.tar.gz" && -f "$STAGE_DIR/stalwart-data.tar.gz" ]] || {
  echo "Required Stalwart volume archives are missing." >&2; exit 8;
}

backup_current_volume() {
  local volume="$1" filename="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || return 0
  docker run --rm --network none -v "$volume:/source:ro" -v "$PRE_RESTORE_DIR:/backup" alpine:3.21 sh -c "tar czf /backup/$filename -C /source ."
}

restore_volume() {
  local volume="$1" archive="$2"
  docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
  docker run --rm --network none -v "$volume:/target" -v "$STAGE_DIR/$archive:/backup.tar.gz:ro" alpine:3.21 sh -c "find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar xzf /backup.tar.gz -C /target"
}

echo "[1/4] Create a local pre-restore safety copy"
backup_current_volume "izakhono-stalwart-etc" "pre-restore-stalwart-etc.tar.gz"
backup_current_volume "izakhono-stalwart-data" "pre-restore-stalwart-data.tar.gz"

echo "[2/4] Stop Stalwart"
docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml stop stalwart

echo "[3/4] Restore Stalwart volumes"
restore_volume "izakhono-stalwart-etc" "stalwart-etc.tar.gz"
restore_volume "izakhono-stalwart-data" "stalwart-data.tar.gz"

if [[ -f "$STAGE_DIR/mail-node.env" ]]; then
  cp "$STAGE_DIR/mail-node.env" "$ROOT/.env.restored"
  chmod 600 "$ROOT/.env.restored"
fi
if [[ -d "$STAGE_DIR/mail-secrets" ]]; then
  cp -a "$STAGE_DIR/mail-secrets" "$ROOT/secrets.restored"
  chmod -R go-rwx "$ROOT/secrets.restored"
fi

echo "[4/4] Start and verify Stalwart"
docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml up -d
CID="$(docker compose --env-file "$ENV_FILE" -f docker-compose.mail.yml ps -q stalwart)"
[[ -n "$CID" ]] || { echo "Stalwart container was not created after restore." >&2; exit 10; }
for attempt in $(seq 1 30); do
  HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$CID" 2>/dev/null || true)"
  [[ "$HEALTH" == "healthy" ]] && break
  [[ "$attempt" -lt 30 ]] || { echo "Stalwart did not become healthy after restore." >&2; exit 9; }
  sleep 3
done

echo "Pre-restore local safety copy: $PRE_RESTORE_DIR"
echo "Stalwart data restored. Review .env.restored and secrets.restored before replacing current secrets."
echo "Run the full MAIL-ACCEPTANCE-REAL.sh checks and a real send/receive test."
echo "A successful volume restore is not, by itself, a verified mail recovery drill."
