#!/usr/bin/env sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$APP_DIR"

echo "[1/5] Building IZAKHONO BUSINESS AI owned runtime..."
docker compose build --pull

echo "[2/5] Starting container..."
docker compose up -d

echo "[3/5] Waiting for local health..."
i=0
until curl -fsS http://127.0.0.1:8787/health | grep -q '"ok":true'; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then
    echo "Health gate failed."
    docker compose ps
    docker compose logs --tail=120
    exit 1
  fi
  sleep 2
done

echo "[4/5] Confirming UI identity..."
curl -fsS http://127.0.0.1:8787/ | grep -q "IZAKHONO BUSINESS AI"

echo "[5/5] Owned runtime ready locally."
echo "NEXT: route businessai.izakhono.co.za through IZAKHONO EDGE/TLS to 127.0.0.1:8787"
echo "Then run:"
echo "  node acceptance.mjs https://businessai.izakhono.co.za"
