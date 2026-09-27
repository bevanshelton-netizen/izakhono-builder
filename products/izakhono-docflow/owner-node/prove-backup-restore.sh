#!/usr/bin/env bash
set -euo pipefail

APP="${DOCFLOW_CONTAINER:-izakhono-docflow}"
BACKUP_DIR="${DOCFLOW_BACKUP_DIR:-/var/lib/izakhono-node/evidence/docflow-backups}"
REPORT_DIR="${DOCFLOW_REPORT_DIR:-/var/lib/izakhono-node/evidence}"
NOW="$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_CONTAINER="docflow-restore-proof-$NOW"
RESTORE_VOLUME="docflow_restore_proof_$NOW"

for cmd in docker curl python3 sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[STOP] Missing $cmd."; exit 2; }
done

docker inspect "$APP" >/dev/null 2>&1 || { echo "[STOP] DOCFLOW container not found: $APP"; exit 3; }
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$APP")"
VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$APP")"
[ -n "$VOLUME" ] || { echo "[STOP] DOCFLOW /app/data named volume not found."; exit 4; }

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
BACKUP_FILE="$BACKUP_DIR/docflow-$NOW.tgz"

docker run --rm --user root   -v "$VOLUME:/source:ro"   -v "$BACKUP_DIR:/backup"   "$IMAGE" sh -lc "cd /source && tar -czf /backup/$(basename "$BACKUP_FILE") ."

[ -s "$BACKUP_FILE" ] || { echo "[FAIL] Backup archive is empty."; exit 5; }
BACKUP_SHA="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"

docker volume create "$RESTORE_VOLUME" >/dev/null
cleanup(){
  docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$RESTORE_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm --user root   -v "$RESTORE_VOLUME:/restore"   -v "$BACKUP_DIR:/backup:ro"   "$IMAGE" sh -lc "cd /restore && tar -xzf /backup/$(basename "$BACKUP_FILE")"

PROBE_SECRET="restore-proof-$NOW"
printf -v DOCFLOW_ADMIN_SECRET '%s' "$PROBE_SECRET"
export DOCFLOW_ADMIN_SECRET
docker run -d --name "$RESTORE_CONTAINER"   -e DOCFLOW_ADMIN_SECRET   -e APP_ENV=restore-proof   -p 127.0.0.1::8787   -v "$RESTORE_VOLUME:/app/data"   "$IMAGE" >/dev/null

HOST_PORT="$(docker port "$RESTORE_CONTAINER" 8787/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -1)"
[ -n "$HOST_PORT" ] || { echo "[FAIL] Restore probe port not allocated."; exit 6; }

READY_JSON=""
for _ in $(seq 1 45); do
  if READY_JSON="$(curl -fsS --max-time 5 "http://127.0.0.1:$HOST_PORT/api/ready" 2>/dev/null)"; then
    break
  fi
  sleep 2
done
[ -n "$READY_JSON" ] || { docker logs "$RESTORE_CONTAINER" || true; echo "[FAIL] Restored DOCFLOW did not become ready."; exit 7; }

REPORT="$REPORT_DIR/izakhono-docflow-backup-restore-$NOW.json"
python3 - "$BACKUP_FILE" "$BACKUP_SHA" "$IMAGE" "$VOLUME" "$READY_JSON" "$REPORT" <<'PY'
import json,sys,time,pathlib
backup,sha,image,volume,ready_raw,report=sys.argv[1:]
ready=json.loads(ready_raw)
ok=bool(ready.get("ok")) and ready.get("database")=="ready" and bool(ready.get("owner_secret_configured"))
data={
  "schema":"izakhono.docflow.backup_restore.v1",
  "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "source_container":"izakhono-docflow",
  "source_image":image,
  "source_volume":volume,
  "backup_file":backup,
  "backup_sha256":sha,
  "restore_probe_ready":ok,
  "readiness":ready,
  "production_data_modified":False
}
pathlib.Path(report).write_text(json.dumps(data,indent=2))
print(json.dumps(data,indent=2))
if not ok:
  raise SystemExit(8)
PY

echo "[PASS] DOCFLOW backup + isolated restore proof completed."
echo "REPORT=$REPORT"
echo "BACKUP=$BACKUP_FILE"
