#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }
command -v curl >/dev/null || { echo "[STOP] curl is required."; exit 1; }

: "${NODE01_ADMIN_TOKEN:?Set NODE01_ADMIN_TOKEN before installation}"

printf '%s\n' "[1/3] Building NODE01 control runtime..."
docker compose build
printf '%s\n' "[2/3] Starting NODE01..."
docker compose up -d
printf '%s\n' "[3/3] Verifying NODE01 health..."
curl -fsS http://127.0.0.1:8090/health
printf '\n%s\n' "[PASS] IZAKHONO NODE01 control runtime is operational."
