#!/usr/bin/env bash
set -euo pipefail

STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono/state}"
APP="izakhono-super-engine"
CONTAINER="izakhono-izakhono-super-engine"
RELEASE_DIR="$STATE_ROOT/releases/$APP"
CANDIDATE="$RELEASE_DIR/candidate.json"
ROUTE="${IZAKHONO_SUPER_ENGINE_ROUTE:-https://super-engine.izakhono.co.za}"

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[PASS] $*"; }

command -v jq >/dev/null || fail "jq is required"
command -v curl >/dev/null || fail "curl is required"
command -v docker >/dev/null || fail "docker is required"
test -f "$CANDIDATE" || fail "candidate release receipt is missing: $CANDIDATE"

jq -e '
  .schema == "izakhono.release/v1" and
  .application.slug == "izakhono-super-engine" and
  .runtime.port == 8787 and
  .runtime.healthPath == "/health" and
  .runtime.network == "izakhono-edge" and
  (.routes.public_https | startswith("https://")) and
  (.release.source | length > 0) and
  (.release.artifact_digest | test("^sha256:[a-f0-9]{64}$"))
' "$CANDIDATE" >/dev/null || fail "candidate receipt failed validation"
pass "candidate receipt validated"

test "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)" = "healthy" || fail "$CONTAINER is not healthy"
pass "container health is healthy"

docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:8787/health').then(async r=>{const t=await r.text(); process.stdout.write(t); process.exit(r.ok?0:1)}).catch(e=>{console.error(e); process.exit(1)})" >/tmp/izakhono-super-engine-health.json || fail "local container health endpoint failed"
jq -e '.ok == true' /tmp/izakhono-super-engine-health.json >/dev/null || fail "local health endpoint did not report ok=true"
pass "local HTTP health accepted"

curl --fail --silent --show-error --location --max-time 15 "$ROUTE/health" >/tmp/izakhono-super-engine-public-health.json || fail "public HTTPS health endpoint is not reachable: $ROUTE/health"
jq -e '.ok == true' /tmp/izakhono-super-engine-public-health.json >/dev/null || fail "public HTTPS health did not report ok=true"
pass "public HTTPS health accepted"

printf '%s\n' "[ACCEPTED] $APP candidate source=$(jq -r '.release.source' "$CANDIDATE") route=$(jq -r '.routes.public_https' "$CANDIDATE")"
