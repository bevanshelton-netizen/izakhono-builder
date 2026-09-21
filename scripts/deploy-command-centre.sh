#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "IZAKHONO COMMANDS - NODE01 / OWNER DEPLOY"
echo "============================================================"
echo "Validates and deploys IZAKHONO Builder without committing secrets."

command -v node >/dev/null 2>&1 || { echo "[STOP] Node.js is not installed."; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "[STOP] npx is not installed."; exit 1; }

echo "[1/6] Checking Cloudflare login..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Cloudflare login is not active."
  echo "Run: npx wrangler login"
  echo "Then rerun this launcher."
  exit 1
fi

echo "[2/6] Installing dependencies..."
npm install --ignore-scripts --no-audit --no-fund

echo "[3/6] Validating production bundle..."
npm run validate

echo "[4/6] Deploying Worker and static assets..."
npx wrangler deploy

echo "[5/6] Verifying public health endpoint..."
curl -fsS https://ai.izakhono.co.za/api/health
echo

echo "[6/6] Verifying Command Centre deployment marker..."
curl -fsS https://ai.izakhono.co.za/commands/deploy.json
echo

echo "============================================================"
echo "[PASS] IZAKHONO COMMANDS is deployed and publicly reachable."
echo "Open: https://ai.izakhono.co.za/commands"
echo "============================================================"
