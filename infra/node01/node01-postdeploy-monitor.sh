#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

NODE01_ID="${NODE01_ID:-NODE01}"
NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
CHECKS="${CHECKS:-3}"

for ((i=1; i<=CHECKS; i++)); do
  printf '[NODE01] post-deploy health check %d/%d node=%s\n' "$i" "$CHECKS" "$NODE01_ID"
  NAV_URL="$NAV_URL" EXPECTED_RELEASE="${EXPECTED_RELEASE:-}" ./infra/node01/node01-production-status.sh
  if (( i < CHECKS )); then sleep "$INTERVAL_SECONDS"; fi
done

printf '[NODE01] post-deploy monitoring PASS\n'
