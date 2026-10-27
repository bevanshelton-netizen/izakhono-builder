#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

: "${SUPER_CLOUD_ADMIN_TOKEN:?Set SUPER_CLOUD_ADMIN_TOKEN}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"
: "${MINIO_ROOT_USER:?Set MINIO_ROOT_USER}"
: "${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD}"

export SUPER_CLOUD_ADMIN_TOKEN POSTGRES_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD

echo "[IZAKHONO SUPER CLOUD] Building core services..."
docker compose build

echo "[IZAKHONO SUPER CLOUD] Starting core services..."
docker compose up -d

echo "[IZAKHONO SUPER CLOUD] Waiting for control plane..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8180/health >/dev/null 2>&1; then
    echo "[IZAKHONO SUPER CLOUD] Control plane healthy."
    exit 0
  fi
  sleep 2
done

echo "[IZAKHONO SUPER CLOUD] Health check failed."
docker compose ps
exit 1
