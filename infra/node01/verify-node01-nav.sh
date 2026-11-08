#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE01_ID="${NODE01_ID:-NODE01}"
export NAV_ENGINE_VERIFY_URL="${NAV_ENGINE_VERIFY_URL:-http://127.0.0.1:8788}"
export NAV_WEB_VERIFY_URL="${NAV_WEB_VERIFY_URL:-http://127.0.0.1:8787}"
export NAV_PUBLIC_URL="${NAV_PUBLIC_URL:-https://nav.izakhono.africa}"

printf '[NODE01] verifying local owned engine and web gateway...\n'
./products/izakhono-nav/stack/scripts/verify.sh

printf '\n[NODE01] verifying public production endpoint...\n'
node infra/contabo/production-verify-nav.js "$NAV_PUBLIC_URL"
printf '[NODE01] owned NAV production verification passed.\n'
