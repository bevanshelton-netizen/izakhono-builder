#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO-owned I-CONNECT node admission gate.
# Read-only: validates the host and repository deployment contract before release.

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
DEPLOY_DIR="$APP_DIR/products/i-connect/deploy"
fail=0

pass(){ echo "[PASS] $1"; }
fail(){ echo "[FAIL] $1"; fail=1; }

[[ "$(id -u)" -eq 0 ]] && pass "root access" || fail "root access required"
command -v docker >/dev/null 2>&1 && pass "docker" || fail "docker missing"
command -v git >/dev/null 2>&1 && pass "git" || fail "git missing"
command -v curl >/dev/null 2>&1 && pass "curl" || fail "curl missing"
docker compose version >/dev/null 2>&1 && pass "docker compose" || fail "docker compose unavailable"
systemctl is-active --quiet docker && pass "docker service" || fail "docker service inactive"

[[ -f "$DEPLOY_DIR/docker-compose.owned.yml" ]] && pass "owned compose file" || fail "owned compose file missing"
[[ -f "$DEPLOY_DIR/.env" ]] && pass "protected environment file" || fail "deploy/.env missing"
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  mode="$(stat -c '%a' "$DEPLOY_DIR/.env")"
  [[ "$mode" == "600" ]] && pass "environment permissions 0600" || fail "deploy/.env permissions are $mode; expected 0600"
fi

docker compose -f "$DEPLOY_DIR/docker-compose.owned.yml" config >/dev/null 2>&1 && pass "compose resolves" || fail "compose configuration invalid"

for port in 80 443; do
  if ss -ltn 2>/dev/null | grep -qE ":${port}[[:space:]]"; then
    pass "TCP $port is listening"
  else
    echo "[INFO] TCP $port is not currently listening; acceptable before first deployment."
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "I-CONNECT owned-node admission FAILED."
  exit 1
fi

echo "I-CONNECT owned-node admission PASSED."
