#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${NODE01_BACKUP_ROOT:-/var/backups/izakhono-node01}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"
RETENTION_DAYS="${NODE01_BACKUP_RETENTION_DAYS:-30}"
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$DEST"
command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }

if [[ "$DEST" == "$SOURCE_ROOT"/* ]]; then
  echo "[STOP] Backup destination must not be inside the runtime source tree."; exit 1
fi

echo "[1/7] Capturing NODE01 configuration..."
mkdir -p "$DEST/config"
for f in docker-compose.yml node01.spec.json node01-services.json backup-policy.json monitoring-policy.json deployment-policy.json workload-state.schema.json node-cluster.json heartbeat-policy.json node02-replication-policy.json node01-network-topology.json node01-storage-layout.json node01-hardware-profile.json; do
  [[ -f "$SOURCE_ROOT/$f" ]] && cp "$SOURCE_ROOT/$f" "$DEST/config/" || true
done

printf '%s\n' "[2/7] Capturing workload inventory..."
docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' > "$DEST/containers.txt"
docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}' > "$DEST/images.txt"
docker volume ls > "$DEST/volumes.txt"

printf '%s\n' "[3/7] Capturing private registry metadata..."
curl -fsS http://127.0.0.1:5000/v2/_catalog > "$DEST/registry-catalog.json" 2>/dev/null || printf '%s\n' '{"status":"unavailable"}' > "$DEST/registry-catalog.json"

printf '%s\n' "[4/7] Backing up registry volume..."
if docker volume inspect izakhono_node01_registry >/dev/null 2>&1; then
  docker run --rm -v izakhono_node01_registry:/source -v "$DEST":/backup alpine:3.20 sh -c 'tar czf /backup/registry-data.tgz -C /source .'
else
  printf '%s\n' 'registry volume not present' > "$DEST/registry-volume.txt"
fi

printf '%s\n' "[5/7] Recording host and runtime metadata..."
printf 'NODE_ID=NODE01\nBACKUP_UTC=%s\nHOSTNAME=%s\nRETENTION_DAYS=%s\nSOURCE_ROOT=%s\n' "$STAMP" "$(hostname)" "$RETENTION_DAYS" "$SOURCE_ROOT" > "$DEST/MANIFEST"

docker version > "$DEST/docker-version.txt" 2>&1 || true
docker info > "$DEST/docker-info.txt" 2>&1 || true

printf '%s\n' "[6/7] Writing checksums..."
( cd "$DEST" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )

printf '%s\n' "[7/7] Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +

echo "[PASS] NODE01 backup created: $DEST"
