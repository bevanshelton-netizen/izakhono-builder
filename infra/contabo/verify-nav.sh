#!/usr/bin/env bash
set -euo pipefail

NAV_URL="${NAV_URL:-https://nav.izakhono.africa}"
printf '[NAV] verifying %s\n' "$NAV_URL"

health="$(curl -fsS "$NAV_URL/health")"
printf '%s\n' "$health"
printf '[NAV] checking manifest...\n'
curl -fsSI "$NAV_URL/manifest.webmanifest" >/dev/null
printf '[NAV] checking service worker...\n'
curl -fsSI "$NAV_URL/sw.js" >/dev/null
printf '[NAV] checking icon...\n'
curl -fsSI "$NAV_URL/icon.svg" >/dev/null
printf '[NAV] owned HTTPS runtime verification passed.\n'
