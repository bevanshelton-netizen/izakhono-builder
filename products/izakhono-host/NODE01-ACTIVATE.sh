#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

printf '\nIZAKHONO HOST — NODE01 ACTIVATION\n\n'

# Stage 1: host/network preflight.
./NODE-PREFLIGHT.sh

# Stage 2: bootstrap the owned runtime. This creates local secrets when
# necessary, validates compose, starts the stack and waits for health.
./bootstrap-owned.sh

# Stage 3: formal compliance gate. Activation is not considered complete
# unless the post-bootstrap node satisfies the same acceptance contract used
# by the compliance report.
./NODE-COMPLIANCE.sh

# Stage 4: explicit local health evidence.
echo
curl -fsS http://127.0.0.1:8080/health
echo
docker compose --env-file .env -f docker-compose.owned.yml exec -T jarvis-api node -e "fetch('http://127.0.0.1:8080/health/ready').then(async r=>{const body=await r.text();process.stdout.write(body+'\\n');process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

echo "NODE01 ACTIVATION: PASSED"
echo "Owned runtime is healthy and the compliance gate passed."
echo "Verification:"
echo "  docker compose --env-file .env -f docker-compose.owned.yml ps"
echo "  docker compose --env-file .env -f docker-compose.owned.yml logs --tail=100 host-runtime jarvis-api edge"
echo "  ss -lntup | grep -E ':(53|80|443)\\b'"
echo
