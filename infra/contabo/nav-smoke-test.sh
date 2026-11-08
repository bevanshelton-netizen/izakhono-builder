#!/usr/bin/env bash
set -euo pipefail

ENGINE_URL="${NAV_ENGINE_URL:-http://127.0.0.1:8788}"
WEB_URL="${NAV_WEB_URL:-http://127.0.0.1:8787}"
printf '[NAV] smoke test: engine=%s web=%s\n' "$ENGINE_URL" "$WEB_URL"

health="$(curl -fsS "$ENGINE_URL/api/health")"
printf '%s\n' "$health"
printf '%s' "$health" | grep -q '"product":"IZAKHONO NAV ENGINE"'
printf '%s' "$health" | grep -q '"routing":"ready"'
printf '%s' "$health" | grep -q '"search":"ready"'
printf '%s' "$health" | grep -q '"tiles":"ready"'

curl -fsS "$ENGINE_URL/v1/runtime" | grep -q '"runtimeClass":"owned"'
curl -fsS "$WEB_URL/" | grep -q 'IZAKHONO NAV'
curl -fsSI "$WEB_URL/manifest.webmanifest" >/dev/null
curl -fsSI "$WEB_URL/sw.js" >/dev/null

curl -fsS "$ENGINE_URL/api/search?q=Johannesburg" | grep -q 'Johannesburg'
curl -fsS "$ENGINE_URL/api/route/driving/28.0473,-26.2041;28.0478,-26.1950" | grep -q '"geometry"'
curl -fsS "$ENGINE_URL/tiles/10/591/589.png" -o /tmp/izakhono-nav-smoke-tile.png
test -s /tmp/izakhono-nav-smoke-tile.png

printf '[NAV] owned-stack smoke test passed.\n'
