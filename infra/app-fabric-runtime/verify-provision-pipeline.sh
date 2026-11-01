#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_ROOT="${IZAKHONO_PROVISIONER_STATE:-${ROOT}/state-test}"
MANIFEST="${ROOT}/manifests/faisready.json"
export IZAKHONO_PROVISIONER_STATE="$STATE_ROOT"
rm -rf "$STATE_ROOT"
mkdir -p "$STATE_ROOT"

"$ROOT/provisioner.sh" plan "$MANIFEST" >/dev/null
"$ROOT/provisioner.sh" register "$MANIFEST" >/dev/null
"$ROOT/provisioner.sh" provision "$MANIFEST" >/dev/null

PROVISION="${STATE_ROOT}/provisioning/faisready.json"
"$ROOT/deploy-gate.sh" deploy "$PROVISION" >/dev/null

if IZAKHONO_HEALTH_VERIFIED=true "$ROOT/deploy-gate.sh" health "$PROVISION" >/dev/null; then :; else
  echo "[FAIL] health gate unexpectedly failed" >&2
  exit 1
fi

if IZAKHONO_ACCEPTANCE_VERIFIED=true "$ROOT/deploy-gate.sh" accept "$PROVISION" >/dev/null; then :; else
  echo "[FAIL] acceptance gate unexpectedly failed" >&2
  exit 1
fi

jq -e '.status == "REGISTERED" and .live == false' "$STATE_ROOT/registry/faisready.json" >/dev/null
jq -e '.status == "PROVISION_READY" and .live == false' "$PROVISION" >/dev/null
jq -e '.status == "DEPLOY_READY" and .live == false' "$STATE_ROOT/deployments/faisready.json" >/dev/null
jq -e '.status == "HEALTH_VERIFIED" and .live == false' "$STATE_ROOT/health/faisready.json" >/dev/null
jq -e '.status == "ACCEPTED" and .live == false' "$STATE_ROOT/acceptance/faisready.json" >/dev/null

echo "[PASS] Universal provision → deploy → health → acceptance contract verified without LIVE promotion."
