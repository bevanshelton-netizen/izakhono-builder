#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }
command -v curl >/dev/null || { echo "[STOP] curl is required."; exit 1; }

: "${NODE01_ADMIN_TOKEN:?Set NODE01_ADMIN_TOKEN before installation}"

printf '%s\n' "[1/4] Building NODE01 control runtime..."
docker compose build
printf '%s\n' "[2/4] Starting NODE01 control plane and private registry..."
docker compose up -d
printf '%s\n' "[3/4] Verifying NODE01 health..."
curl -fsS http://127.0.0.1:8090/health
printf '\n%s\n' "[4/4] Verifying private registry..."
curl -fsS http://127.0.0.1:5000/v2/
printf '\n%s\n' "[PASS] IZAKHONO NODE01 control plane and private registry are operational."
