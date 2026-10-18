#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf '\nIZAKHONO HOST — NODE01 ACTIVATION\n\n'

./NODE-PREFLIGHT.sh
./bootstrap-owned.sh

echo
curl -fsS http://127.0.0.1:8080/health
echo

echo "Owned runtime is running on this node."
echo "Verification:"
echo "  docker compose --env-file .env -f docker-compose.owned.yml ps"
echo "  docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 host-runtime edge"
echo "  ss -lntup | grep -E ':(53|80|443)\\b'"
echo
