#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
export NODE01_ID="${NODE01_ID:-NODE01}"

printf '[NODE01] target=%s url=%s\n' "$NODE01_ID" "$NAV_URL"

curl -fsS "$NAV_URL/health" >/tmp/izakhono-nav-health.json
curl -fsS "$NAV_URL/ready" >/tmp/izakhono-nav-ready.json
curl -fsS "$NAV_URL/version" >/tmp/izakhono-nav-version.json

node - <<'NODE'
const fs = require('fs');
const health = JSON.parse(fs.readFileSync('/tmp/izakhono-nav-health.json','utf8'));
const ready = JSON.parse(fs.readFileSync('/tmp/izakhono-nav-ready.json','utf8'));
const version = JSON.parse(fs.readFileSync('/tmp/izakhono-nav-version.json','utf8'));
if (health.product !== 'IZAKHONO NAV') throw new Error('Unexpected product');
if (ready.ready !== true) throw new Error('NAV is not ready');
if (version.runtime !== 'owned') throw new Error('Runtime is not owned');
console.log('NODE01 NAV health/readiness/runtime identity: PASS');
NODE

NAV_URL="$NAV_URL" node infra/contabo/production-verify-nav.js
printf '[NODE01] NAV production verification passed.\n'
