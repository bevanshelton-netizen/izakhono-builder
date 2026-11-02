#!/usr/bin/env bash
set -euo pipefail

NAV_URL="${NAV_URL:-https://nav.izakhono.africa}"
printf '[NAV] verifying %s\n' "$NAV_URL"

health="$(curl -fsS "$NAV_URL/health")"
printf '%s\n' "$health"
printf '%s' "$health" | grep -q '"product":"IZAKHONO NAV"'
printf '%s' "$health" | grep -q '"runtime":"owned"'

printf '[NAV] checking readiness...\n'
ready="$(curl -fsS "$NAV_URL/ready")"
printf '%s\n' "$ready"
printf '%s' "$ready" | grep -q '"ready":true'

printf '[NAV] checking version...\n'
version="$(curl -fsS "$NAV_URL/version")"
printf '%s\n' "$version"
printf '%s' "$version" | grep -q '"product":"IZAKHONO NAV"'
printf '%s' "$version" | grep -q '"runtime":"owned"'

printf '[NAV] checking security headers...\n'
headers="$(curl -fsSI "$NAV_URL/")"
printf '%s\n' "$headers" | grep -qi '^x-content-type-options: nosniff'
printf '%s\n' "$headers" | grep -qi '^referrer-policy: strict-origin-when-cross-origin'
printf '%s\n' "$headers" | grep -qi '^permissions-policy:'

printf '[NAV] checking manifest...\n'
curl -fsSI "$NAV_URL/manifest.webmanifest" >/dev/null
printf '[NAV] checking service worker...\n'
curl -fsSI "$NAV_URL/sw.js" >/dev/null
printf '[NAV] checking icon...\n'
curl -fsSI "$NAV_URL/icon.svg" >/dev/null

printf '[NAV] owned HTTPS runtime verification passed.\n'
