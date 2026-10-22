#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose ps
printf '\nListening ports:\n'
docker exec izakhono-mailserver sh -c "ss -lnt | grep -E ':25 |:465 |:587 |:993 ' || true"
printf '\nWebmail HTTP check:\n'
curl -fsSI https://mail.izakhonoafrica.co.za/ | head -n 8 || true
