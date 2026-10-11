#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "[STOP] Usage: restore-node01.sh /path/to/backup"; exit 1; }
command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }

if [[ -f "$BACKUP_DIR/SHA256SUMS" ]]; then
  echo "[1/6] Verifying backup integrity..."
  ( cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS )
fi

echo "[2/6] Restoring registry volume..."
if [[ -f "$BACKUP_DIR/registry-data.tgz" ]]; then
  docker volume create izakhono_node01_registry >/dev/null
  docker run --rm -v izakhono_node01_registry:/target -v "$BACKUP_DIR":/backup alpine:3.20 sh -c 'rm -rf /target/* && tar xzf /backup/registry-data.tgz -C /target'
fi

echo "[3/6] Restoring NODE01 configuration..."
for f in docker-compose.yml node01.spec.json node01-services.json backup-policy.json monitoring-policy.json deployment-policy.json workload-state.schema.json node-cluster.json heartbeat-policy.json; do
  [[ -f "$BACKUP_DIR/$f" ]] && cp "$BACKUP_DIR/$f" "./$f" || true
done

echo "[4/6] Starting restored control plane..."
[[ -f docker-compose.yml ]] && docker compose up -d

echo "[5/6] Health verification..."
curl -fsS http://127.0.0.1:8090/health
printf '\n'
curl -fsS http://127.0.0.1:5000/v2/
printf '\n'

echo "[6/6] Restore gate passed. Workloads must be promoted only after individual health checks."
