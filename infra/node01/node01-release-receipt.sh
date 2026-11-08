#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NAV_ENGINE_URL="${NAV_ENGINE_URL:-http://127.0.0.1:8788}"
export NAV_WEB_URL="${NAV_WEB_URL:-http://127.0.0.1:8787}"
export NODE01_ID="${NODE01_ID:-NODE01}"
export NAV_PUBLIC_URL="${NAV_PUBLIC_URL:-https://${NAV_DOMAIN:-nav.izakhono.africa}}"
export RECEIPT_DIR="${RECEIPT_DIR:-infra/node01/evidence}"

mkdir -p "$RECEIPT_DIR"

release="$(git rev-parse HEAD)"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
health="$(curl -fsS "$NAV_ENGINE_URL/api/health")"
runtime="$(curl -fsS "$NAV_ENGINE_URL/v1/runtime")"
curl -fsS "$NAV_WEB_URL/" | grep -q 'IZAKHONO NAV'
node infra/contabo/production-verify-nav.js "$NAV_PUBLIC_URL"

RELEASE="$release" TIMESTAMP="$timestamp" NODE01_ID="$NODE01_ID" NAV_ENGINE_URL="$NAV_ENGINE_URL" NAV_PUBLIC_URL="$NAV_PUBLIC_URL" HEALTH="$health" RUNTIME="$runtime" RECEIPT_DIR="$RECEIPT_DIR" node <<'NODE'
const fs = require('fs');
const path = require('path');
const health = JSON.parse(process.env.HEALTH);
const runtime = JSON.parse(process.env.RUNTIME);

if (health.product !== 'IZAKHONO NAV ENGINE') throw new Error('Unexpected NAV engine identity');
if (health.ready !== true || health.routing !== 'ready' || health.search !== 'ready' || health.tiles !== 'ready') {
  throw new Error('Owned NAV dependencies are not ready');
}
if (runtime.runtimeClass !== 'owned') throw new Error('NAV runtime is not marked owned');
if (!runtime.releaseId) throw new Error('Missing NAV release identity');

const receipt = {
  product: 'IZAKHONO NAV',
  runtime_target: process.env.NODE01_ID,
  runtime_ownership: 'IZAKHONO-owned',
  release_commit: process.env.RELEASE,
  release_id: runtime.releaseId,
  runtime_id: runtime.runtimeId,
  verified_at: process.env.TIMESTAMP,
  engine_url: process.env.NAV_ENGINE_URL,
  public_https_url: process.env.NAV_PUBLIC_URL,
  checks: {
    engine_health: true,
    routing_ready: true,
    search_ready: true,
    owned_tiles_ready: true,
    owned_runtime_identity: true,
    public_https_tls_hsts: true,
    public_search_route_and_tile_smoke: true,
    offline_tile_cache_handler: true
  }
};

const file = path.join(process.env.RECEIPT_DIR, `nav-${process.env.RELEASE.slice(0, 12)}.json`);
fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
console.log(`NODE01 release receipt written: ${file}`);
NODE

printf '[NODE01] owned NAV release receipt verified for %s\n' "$release"
