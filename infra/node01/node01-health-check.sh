#!/usr/bin/env bash
set -euo pipefail

ENGINE_URL="${NAV_ENGINE_URL:-http://127.0.0.1:8788}"
WEB_URL="${NAV_WEB_URL:-http://127.0.0.1:8787}"
NODE01_ID="${NODE01_ID:-NODE01}"

health="$(curl -fsS "$ENGINE_URL/api/health")"
runtime="$(curl -fsS "$ENGINE_URL/v1/runtime")"
curl -fsS "$WEB_URL/" | grep -q 'IZAKHONO NAV'

HEALTH="$health" RUNTIME="$runtime" NODE01_ID="$NODE01_ID" node <<'NODE'
const health = JSON.parse(process.env.HEALTH);
const runtime = JSON.parse(process.env.RUNTIME);
if (health.product !== 'IZAKHONO NAV ENGINE') throw new Error('Unexpected NAV engine identity');
if (health.ready !== true || health.routing !== 'ready' || health.search !== 'ready' || health.tiles !== 'ready') {
  throw new Error('NAV owned dependencies are not ready');
}
if (runtime.runtimeClass !== 'owned') throw new Error('NAV runtime is not owned');
console.log(JSON.stringify({
  node: process.env.NODE01_ID,
  product: health.product,
  releaseId: runtime.releaseId,
  runtimeId: runtime.runtimeId,
  routing: health.routing,
  search: health.search,
  tiles: health.tiles,
  status: 'PASS'
}, null, 2));
NODE
