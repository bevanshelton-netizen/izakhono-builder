#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

NODE01_ID="${NODE01_ID:-NODE01}"
NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
EXPECTED_RELEASE="${EXPECTED_RELEASE:-}"

printf '[NODE01] status check node=%s url=%s\n' "$NODE01_ID" "$NAV_URL"

if [[ -n "$EXPECTED_RELEASE" ]]; then
  actual="$(git rev-parse HEAD)"
  if [[ "$actual" != "$EXPECTED_RELEASE" ]]; then
    echo "[NODE01] release mismatch: expected $EXPECTED_RELEASE, got $actual" >&2
    exit 21
  fi
fi

health="$(curl -fsS "$NAV_URL/health")"
ready="$(curl -fsS "$NAV_URL/ready")"
version="$(curl -fsS "$NAV_URL/version")"

HEALTH="$health" READY="$ready" VERSION="$version" node <<'NODE'
const health = JSON.parse(process.env.HEALTH);
const ready = JSON.parse(process.env.READY);
const version = JSON.parse(process.env.VERSION);
if (health.product !== 'IZAKHONO NAV') throw new Error('Unexpected product identity');
if (ready.ready !== true) throw new Error('NAV is not ready');
if (version.runtime !== 'owned') throw new Error('Runtime is not owned');
console.log('NODE01 NAV status: HEALTH=PASS READY=PASS OWNED_RUNTIME=PASS');
NODE

NAV_URL="$NAV_URL" node infra/contabo/production-verify-nav.js
printf '[NODE01] production verification PASS\n'
