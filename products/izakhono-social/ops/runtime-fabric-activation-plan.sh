#!/usr/bin/env bash
set -euo pipefail

# CONNECTA Runtime Fabric activation planner.
# This script deliberately plans and validates the activation boundary; it does
# not provision a provider, change DNS/TLS, or claim production readiness.

SHA="${1:-}"
TARGET="${CONNECTA_RUNTIME_TARGET:-}"
OUT="${CONNECTA_RUNTIME_PLAN_OUT:-./connecta-runtime-activation-plan.json}"

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: supply an immutable 40-character CONNECTA release SHA" >&2
  exit 2
fi
if [[ -z "$TARGET" ]]; then
  echo "ERROR: CONNECTA_RUNTIME_TARGET must identify an operator-approved runtime target" >&2
  exit 2
fi

python3 - "$SHA" "$TARGET" "$OUT" <<'PY'
import json, os, sys, time
sha, target, out = sys.argv[1:]
plan = {
    "schema": "izakhono.connecta.runtime-fabric.activation-plan.v1",
    "status": "RUNTIME_TARGET_SELECTED",
    "release_sha": sha,
    "runtime_target": target,
    "provider_provisioning_requested": False,
    "dns_cutover_requested": False,
    "tls_cutover_requested": False,
    "public_cutover_performed": False,
    "promotion_allowed": False,
    "sequence": [
        "HOST_PREFLIGHT",
        "IMMUTABLE_RELEASE_DEPLOY",
        "LOCAL_HEALTH_AND_SMOKE",
        "BACKUP_RESTORE_AND_ROLLBACK",
        "SECURITY_EVIDENCE",
        "EDGE_TLS",
        "INDEPENDENT_HTTPS",
        "PRODUCTION_PROMOTION_GATE",
    ],
    "created_at_epoch": int(time.time()),
    "evidence_source": "operator_controlled_activation_planner",
}
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(plan, f, indent=2)
    f.write("\n")
print(json.dumps(plan, indent=2))
PY
