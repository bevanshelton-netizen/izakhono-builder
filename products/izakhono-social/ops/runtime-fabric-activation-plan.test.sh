#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(dirname "$0")/runtime-fabric-activation-plan.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SHA="0123456789abcdef0123456789abcdef01234567"

if CONNECTA_RUNTIME_TARGET=test-target CONNECTA_RUNTIME_PLAN_OUT="$TMP/plan.json" bash "$SCRIPT" "$SHA" >/dev/null; then
  test -s "$TMP/plan.json"
else
  echo "planner unexpectedly failed" >&2
  exit 1
fi

python3 - "$TMP/plan.json" "$SHA" <<'PY'
import json, sys
p=json.load(open(sys.argv[1], encoding="utf-8"))
assert p["schema"] == "izakhono.connecta.runtime-fabric.activation-plan.v1"
assert p["release_sha"] == sys.argv[2]
assert p["runtime_target"] == "test-target"
assert p["promotion_allowed"] is False
assert p["public_cutover_performed"] is False
assert p["provider_provisioning_requested"] is False
assert "INDEPENDENT_HTTPS" in p["sequence"]
print("CONNECTA_RUNTIME_FABRIC_ACTIVATION_PLAN: PASS")
PY
