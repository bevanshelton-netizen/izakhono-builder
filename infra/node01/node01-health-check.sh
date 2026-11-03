#!/usr/bin/env bash
set -euo pipefail

NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
NODE01_ID="${NODE01_ID:-NODE01}"

health="$(curl -fsS "$NAV_URL/health")"
ready="$(curl -fsS "$NAV_URL/ready")"
version="$(curl -fsS "$NAV_URL/version")"

HEALTH="$health" READY="$ready" VERSION="$version" NODE01_ID="$NODE01_ID" node <<'NODE'
const health = JSON.parse(process.env.HEALTH);
const ready = JSON.parse(process.env.READY);
const version = JSON.parse(process.env.VERSION);

if (health.product !== 'IZAKHONO NAV') throw new Error('Unexpected product identity');
if (ready.ready !== true) throw new Error('NAV readiness check failed');
if (version.runtime !== 'owned') throw new Error('NAV runtime is not owned');

console.log(JSON.stringify({
  node: process.env.NODE01_ID,
  product: health.product,
  ready: ready.ready,
  runtime: version.runtime,
  status: 'PASS'
}, null, 2));
NODE
