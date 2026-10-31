#!/usr/bin/env bash
set -euo pipefail

STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono/state}"
APP="izakhono-super-engine"
RELEASE_DIR="$STATE_ROOT/releases/$APP"
CANDIDATE="$RELEASE_DIR/candidate.json"
LIVE="$RELEASE_DIR/live.json"
ROLLBACK="$RELEASE_DIR/rollback.json"
ROUTE="${IZAKHONO_SUPER_ENGINE_ROUTE:-https://super-engine.izakhono.co.za}"
HEALTH_URL="${IZAKHONO_SUPER_ENGINE_HEALTH_URL:-http://127.0.0.1:8787/health}"

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

test "$(docker inspect --format '{{.State.Health.Status}}' super_engine 2>/dev/null || true)" = "healthy" || fail "super_engine container is not healthy"
pass "container health is healthy"

curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/tmp/izakhono-super-engine-health.json || fail "local health endpoint failed"
jq -e '.ok == true' /tmp/izakhono-super-engine-health.json >/dev/null || fail "local health endpoint did not report ok=true"
pass "local HTTP health accepted"

if ! curl --fail --silent --show-error --location --max-time 15 "$ROUTE/health" >/tmp/izakhono-super-engine-public-health.json; then
  fail "public HTTPS health endpoint is not reachable: $ROUTE/health"
fi
jq -e '.ok == true' /tmp/izakhono-super-engine-public-health.json >/dev/null || fail "public HTTPS health did not report ok=true"
pass "public HTTPS health accepted"

if [ -f "$LIVE" ]; then
  cp "$LIVE" "$ROLLBACK"
  pass "previous live receipt preserved as rollback target"
else
  printf '%s\n' '{"status":"none","reason":"first_owned_release"}' > "$ROLLBACK"
  pass "first-release rollback marker created"
fi

cp "$CANDIDATE" "$LIVE"
pass "candidate promoted to live"

printf '%s\n' "[ACCEPTED] $APP source=$(jq -r '.release.source' "$LIVE") route=$(jq -r '.routes.public_https' "$LIVE")"
