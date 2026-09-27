#!/usr/bin/env bash
set -euo pipefail

VOLUME="${FLOW_VOLUME_NAME:-izakhono_flow_data}"
IMAGE="${FLOW_IMAGE_NAME:-izakhono/flow:local}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/izakhono/backups/flow}"
STAMP="${FLOW_BACKUP_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_FILE="$BACKUP_ROOT/izakhono-flow-$STAMP.tar.gz"
RESTORE_VOLUME="izakhono_flow_restore_probe_$$"
PROBE_NAME=".flow-persistence-probe"
PROBE_VALUE="FLOW-PERSISTENCE-PROBE-$STAMP-$$"

command -v docker >/dev/null 2>&1 || { echo '[FAIL] docker is required.'; exit 1; }
docker volume inspect "$VOLUME" >/dev/null 2>&1 || { echo "[FAIL] FLOW volume $VOLUME is missing."; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "[FAIL] FLOW image $IMAGE is missing."; exit 1; }
docker inspect izakhono-flow >/dev/null 2>&1 || { echo '[FAIL] izakhono-flow container is missing.'; exit 1; }

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT" 2>/dev/null || true

cleanup(){
  docker volume rm -f "$RESTORE_VOLUME" >/dev/null 2>&1 || true
  docker exec izakhono-flow rm -f "/data/$PROBE_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[FLOW] Proving live volume write..."
docker exec izakhono-flow sh -c "umask 077; printf '%s\n' '$PROBE_VALUE' > '/data/$PROBE_NAME'; sync; test -s '/data/$PROBE_NAME'"

echo "[FLOW] Creating owner backup snapshot..."
docker run --rm \
  -v "$VOLUME:/source:ro" \
  -v "$BACKUP_ROOT:/backup" \
  "$IMAGE" sh -c "tar -C /source -czf '/backup/$(basename "$BACKUP_FILE")' ."

[ -s "$BACKUP_FILE" ] || { echo '[FAIL] FLOW backup archive was not created.'; exit 1; }
chmod 600 "$BACKUP_FILE" 2>/dev/null || true

echo "[FLOW] Restoring snapshot into isolated probe volume..."
docker volume create "$RESTORE_VOLUME" >/dev/null
docker run --rm \
  -v "$RESTORE_VOLUME:/restore" \
  -v "$BACKUP_ROOT:/backup:ro" \
  "$IMAGE" sh -c "tar -xzf '/backup/$(basename "$BACKUP_FILE")' -C /restore"

docker run --rm \
  -v "$RESTORE_VOLUME:/restore:ro" \
  "$IMAGE" sh -c "test -f '/restore/$PROBE_NAME' && grep -Fqx '$PROBE_VALUE' '/restore/$PROBE_NAME'"

echo "[PASS] FLOW persistence + backup + isolated restore proof passed."
echo "FLOW_BACKUP=$BACKUP_FILE"
