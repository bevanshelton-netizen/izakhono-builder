#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "IZAKHONO NODE01 - COMMAND CENTRE INTERNAL-FIRST DEPLOY"
echo "============================================================"

command -v docker >/dev/null 2>&1 || { echo "[STOP] Docker is not installed."; exit 1; }

echo "[1/4] Building owned command gateway..."
docker compose -f internal/node01-command-gateway/docker-compose.yml build

echo "[2/4] Starting owned command gateway..."
docker compose -f internal/node01-command-gateway/docker-compose.yml up -d

echo "[3/4] Checking NODE01 local health..."
curl -fsS http://127.0.0.1:8091/healthz
echo

echo "[4/4] Checking local Command Centre page..."
curl -fsSI http://127.0.0.1:8091/commands | head

echo "============================================================"
echo "[PASS] NODE01 command gateway is running locally."
echo "Internal URL: http://127.0.0.1:8091/commands"
echo "Next EDGE/TLS step: route the owned hostname to 127.0.0.1:8091."
echo "============================================================"
