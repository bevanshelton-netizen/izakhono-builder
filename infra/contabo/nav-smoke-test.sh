#!/usr/bin/env bash
set -euo pipefail

NAV_URL="${NAV_URL:-http://127.0.0.1:8080}"
printf '[NAV] smoke test: %s\n' "$NAV_URL"

health="$(curl -fsS "$NAV_URL/health")"
printf '%s\n' "$health"
printf '%s' "$health" | grep -q '"product":"IZAKHONO NAV"'
printf '%s' "$health" | grep -q '"runtime":"owned"'

ready="$(curl -fsS "$NAV_URL/ready")"
printf '%s\n' "$ready"
printf '%s' "$ready" | grep -q '"ready":true'

version="$(curl -fsS "$NAV_URL/version")"
printf '%s\n' "$version"
printf '%s' "$version" | grep -q '"product":"IZAKHONO NAV"'

printf '[NAV] testing method guard...\n'
status="$(curl -sS -o /dev/null -w '%{http_code}' "$NAV_URL/api/nav/driver-companion")"
test "$status" = "405"

printf '[NAV] testing static shell...\n'
curl -fsS "$NAV_URL/" | grep -q 'IZAKHONO NAV'
curl -fsSI "$NAV_URL/manifest.webmanifest" >/dev/null
curl -fsSI "$NAV_URL/sw.js" >/dev/null

printf '[NAV] smoke test passed.\n'
