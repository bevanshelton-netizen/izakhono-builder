#!/usr/bin/env bash
set -euo pipefail

# NODE01 NAV watchdog. Intended for systemd timer/cron on NODE01.
# Never creates a LIVE claim; records only observed endpoint results.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
NODE01_ID="${NODE01_ID:-NODE01}"
STATE_DIR="${NODE01_STATE_DIR:-/var/lib/izakhono-nav}"
STATE_FILE="$STATE_DIR/watchdog-state.json"
mkdir -p "$STATE_DIR"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if NAV_URL="$NAV_URL" NODE01_ID="$NODE01_ID" bash infra/node01/node01-health-check.sh >"$tmp" 2>&1; then
  status="healthy"
  detail="$(cat "$tmp")"
else
  status="degraded"
  detail="$(cat "$tmp" 2>&1 || true)"
fi

previous="unknown"
if [[ -f "$STATE_FILE" ]]; then
  previous="$(node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status||'unknown')}catch{}" "$STATE_FILE")"
fi

STATUS="$status" PREVIOUS="$previous" DETAIL="$detail" NODE01_ID="$NODE01_ID" NAV_URL="$NAV_URL" STATE_FILE="$STATE_FILE" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const record = {
  node: process.env.NODE01_ID,
  product: 'IZAKHONO NAV',
  status: process.env.STATUS,
  previous_status: process.env.PREVIOUS,
  observed_at: new Date().toISOString(),
  nav_url: process.env.NAV_URL,
  detail: process.env.DETAIL,
  production_claim: false
};
const target = process.env.STATE_FILE;
const temp = target + '.tmp';
fs.writeFileSync(temp, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
fs.renameSync(temp, target);
console.log(JSON.stringify({status: record.status, previous_status: record.previous_status, observed_at: record.observed_at}));
NODE

# Optional transition-only notification. Webhook URL must be supplied by NODE01 secret store.
if [[ "$status" != "$previous" && -n "${NODE01_ALERT_WEBHOOK:-}" ]]; then
  payload="$(STATUS="$status" PREVIOUS="$previous" NODE01_ID="$NODE01_ID" NAV_URL="$NAV_URL" node -e 'console.log(JSON.stringify({text:"IZAKHONO NAV NODE01 status changed: "+process.env.PREVIOUS+" -> "+process.env.STATUS+" ("+process.env.NODE01_ID+", "+process.env.NAV_URL+")"}))')"
  curl --fail --silent --show-error --max-time 8 -H 'Content-Type: application/json' --data "$payload" "$NODE01_ALERT_WEBHOOK" >/dev/null
fi

cat "$tmp"
[[ "$status" == "healthy" ]]
