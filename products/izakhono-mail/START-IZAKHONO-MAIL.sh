#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "[IZAKHONO MAIL] Docker is required on the owner node."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "[IZAKHONO MAIL] Docker daemon is not ready."
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "[IZAKHONO MAIL] curl is required for local health checks."
  exit 1
fi
if [ ! -f owner.env ]; then
  cp owner.env.example owner.env
  chmod 600 owner.env
  echo "[IZAKHONO MAIL] Created owner.env from template. Add the owner token before authenticated relay use."
fi

echo "[IZAKHONO MAIL] Building and starting the private namespace stack..."
docker compose up -d --build

echo "[IZAKHONO MAIL] Waiting for service health..."
for url in \
  http://127.0.0.1:9899/healthz \
  http://127.0.0.1:8787/healthz \
  http://127.0.0.1:8789/healthz \
  http://127.0.0.1:8088/healthz; do
  ok=0
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then ok=1; break; fi
    sleep 1
  done
  if [ "$ok" -ne 1 ]; then
    echo "[IZAKHONO MAIL] Health check failed: $url"
    docker compose ps
    exit 1
  fi
done

echo "[IZAKHONO MAIL] PRIVATE STACK READY"
echo "  Webmail: http://127.0.0.1:8088"
echo "  Mail API: http://127.0.0.1:8787 (authenticated)"
echo "  Identity API: http://127.0.0.1:8789"
echo "  SMTP inbound: 127.0.0.1:2525"
echo "  Private DNS: 127.0.0.1:5353"
echo "  Identity: bevan@izakhono"
echo "  Public Internet email: not enabled until a public domain/DNS and SMTP bridge are configured."
