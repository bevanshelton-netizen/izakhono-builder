#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
WORKER_ID="${1:-}"
[[ "$WORKER_ID" =~ ^[-a-zA-Z0-9_.]{3,80}$ ]] || { echo "Usage: bash ./ENROLL-COMPUTE-NODE.sh <unique-worker-id>" >&2; exit 2; }
[[ -f .env ]] || { echo "Missing HOST .env. Run HOST bootstrap first." >&2; exit 1; }
set -a
source .env
set +a
[[ -n "${COMPUTE_ADMIN_TOKEN:-}" ]] || { echo "COMPUTE_ADMIN_TOKEN is missing." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }
TOKEN="$(docker compose --env-file .env -f docker-compose.owned.yml exec -T -e WORKER_ID="$WORKER_ID" compute-manager node -e "fetch('http://127.0.0.1:8082/api/compute/nodes/enroll',{method:'POST',headers:{authorization:'Bearer '+process.env.COMPUTE_ADMIN_TOKEN,'content-type':'application/json'},body:JSON.stringify({worker_id:process.env.WORKER_ID})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||r.status);process.stdout.write(d.enrollment_token)}).catch(e=>{console.error(e.message);process.exit(1)})")"
[[ -n "$TOKEN" ]] || { echo "Enrollment token was not issued." >&2; exit 1; }
OUT="$ROOT/worker-node/enrollments/$WORKER_ID.env"
mkdir -p "$(dirname "$OUT")"
chmod 700 "$(dirname "$OUT")"
printf 'COMPUTE_MANAGER_URL=%s\nWORKER_ID=%s\nWORKER_ENROLLMENT_TOKEN=%s\nWORKER_POLL_MS=3000\n' "${COMPUTE_MANAGER_PRIVATE_URL:-http://127.0.0.1:8082}" "$WORKER_ID" "$TOKEN" > "$OUT"
chmod 600 "$OUT"
unset TOKEN
echo "One-time enrollment file created: worker-node/enrollments/$WORKER_ID.env"
echo "Transfer it securely to the target host as worker-node/.env. Do not commit or share it publicly."
