#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SUPER_SEO_BASE_URL:-http://127.0.0.1:8097}"

printf 'Checking SUPER SEO V5 health at %s ...\n' "$BASE_URL"
health="$(curl --fail --silent --show-error --max-time 10 "$BASE_URL/health")"
printf '%s\n' "$health"
printf 'SUPER SEO V5 NODE01 health verification: PASS\n'
