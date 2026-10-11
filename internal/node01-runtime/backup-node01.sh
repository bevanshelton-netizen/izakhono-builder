#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${NODE01_BACKUP_ROOT:-/var/backups/izakhono-node01}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"
RETENTION_DAYS="${NODE01_BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$DEST"

command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }

echo "[1/6] Capturing NODE01 configuration..."
cp -a . "$DEST/repository" 2>/dev/null || true

for f in docker-compose.yml node01.spec.json node01-services.json backup-policy.json monitoring-policy.json deployment-policy.json workload-state.schema.json node-cluster.json heartbeat-policy.json; do
  [[ -f "$f" ]] && cp "$f" "$DEST/" || true
done

printf '%s\n' "[2/6] Capturing workload inventory..."
docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' > "$DEST/containers.txt"
docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}' > "$DEST/images.txt"

printf '%s\n' "[3/6] Capturing private registry metadata..."
curl -fsS http://127.0.0.1:5000/v2/_catalog > "$DEST/registry-catalog.json" 2>/dev/null || printf '%s\n' '{"status":"unavailable"}' > "$DEST/registry-catalog.json"

printf '%s\n' "[4/6] Backing up registry volume..."
if docker volume inspect izakhono_node01_registry >/dev/null 2>&1; then
  docker run --rm -v izakhono_node01_registry:/source -v "$DEST":/backup alpine:3.20 sh -c 'tar czf /backup/registry-data.tgz -C /source .'
else
  printf '%s\n' 'registry volume not present' > "$DEST/registry-volume.txt"
fi

printf '%s\n' "[5/6] Writing manifest and checksums..."
cat > "$DEST/MANIFEST" <<EOF
NODE_ID=NODE01
BACKUP_UTC=$STAMP
HOSTNAME=$(hostname)
RETENTION_DAYS=$RETENTION_DAYS
EOF
( cd "$DEST" && find . -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )

printf '%s\n' "[6/6] Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +

echo "[PASS] NODE01 backup created: $DEST"
