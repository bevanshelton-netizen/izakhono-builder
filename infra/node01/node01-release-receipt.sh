#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
export NODE01_ID="${NODE01_ID:-NODE01}"
export RECEIPT_DIR="${RECEIPT_DIR:-infra/node01/evidence}"

mkdir -p "$RECEIPT_DIR"

release="$(git rev-parse HEAD)"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
health="$(curl -fsS "$NAV_URL/health")"
ready="$(curl -fsS "$NAV_URL/ready")"
version="$(curl -fsS "$NAV_URL/version")"

RELEASE="$release" TIMESTAMP="$timestamp" NODE01_ID="$NODE01_ID" NAV_URL="$NAV_URL" HEALTH="$health" READY="$ready" VERSION="$version" RECEIPT_DIR="$RECEIPT_DIR" node <<'NODE'
const fs = require('fs');
const path = require('path');

const health = JSON.parse(process.env.HEALTH);
const ready = JSON.parse(process.env.READY);
const version = JSON.parse(process.env.VERSION);

if (health.product !== 'IZAKHONO NAV') throw new Error('Unexpected product identity');
if (ready.ready !== true) throw new Error('NAV is not ready');
if (version.runtime !== 'owned') throw new Error('NAV runtime is not marked owned');

const receipt = {
  product: 'IZAKHONO NAV',
  runtime_target: process.env.NODE01_ID,
  runtime_ownership: 'IZAKHONO-owned',
  release_commit: process.env.RELEASE,
  verified_at: process.env.TIMESTAMP,
  nav_url: process.env.NAV_URL,
  checks: {
    health: true,
    readiness: true,
    owned_runtime_identity: true
  }
};

const file = path.join(process.env.RECEIPT_DIR, `nav-${process.env.RELEASE.slice(0, 12)}.json`);
fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
console.log(`NODE01 release receipt written: ${file}`);
NODE

printf '[NODE01] release receipt verified for %s\n' "$release"
