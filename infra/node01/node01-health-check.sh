#!/usr/bin/env bash
set -euo pipefail

NAV_ENGINE_URL="${NAV_ENGINE_URL:-http://127.0.0.1:8788}"
NAV_WEB_URL="${NAV_WEB_URL:-http://127.0.0.1:8787}"
NODE01_ID="${NODE01_ID:-NODE01}"

health="$(curl -fsS "$NAV_ENGINE_URL/api/health")"
runtime="$(curl -fsS "$NAV_ENGINE_URL/v1/runtime")"
curl -fsS "$NAV_WEB_URL/" | grep -q 'IZAKHONO NAV'

HEALTH="$health" RUNTIME="$runtime" NODE01_ID="$NODE01_ID" node <<'NODE'
const health = JSON.parse(process.env.HEALTH);
const runtime = JSON.parse(process.env.RUNTIME);
if (health.product !== 'IZAKHONO NAV ENGINE') throw new Error('Unexpected product identity');
if (health.ready !== true || health.routing !== 'ready' || health.search !== 'ready' || health.tiles !== 'ready') {
  throw new Error('Owned NAV dependency health check failed');
}
if (runtime.runtimeClass !== 'owned') throw new Error('NAV runtime is not owned');
console.log(JSON.stringify({
  node: process.env.NODE01_ID,
  product: 'IZAKHONO NAV',
  releaseId: runtime.releaseId,
  runtimeId: runtime.runtimeId,
  routing: health.routing,
  search: health.search,
  tiles: health.tiles,
  status: 'PASS'
}, null, 2));
NODE
