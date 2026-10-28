#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "[FAIL] $1" >&2; exit 1; }
pass(){ echo "[PASS] $1"; }

: "${IZAKHONO_RUNTIME_ID:?IZAKHONO_RUNTIME_ID is required}"
: "${IZAKHONO_RUNTIME_PROVIDER:?IZAKHONO_RUNTIME_PROVIDER is required}"
: "${IZAKHONO_RELEASE_SHA:?IZAKHONO_RELEASE_SHA is required}"

[[ "$IZAKHONO_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "release SHA must be an immutable 40-character SHA"
[[ "$IZAKHONO_RUNTIME_ID" != *NODE01* ]] || fail "physical NODE01 identity is not a runtime prerequisite"
[[ "$IZAKHONO_RUNTIME_ID" != *physical* ]] || fail "physical runtime identity is prohibited"

EVIDENCE_DIR="${IZAKHONO_EVIDENCE_DIR:-/var/lib/izakhono/evidence/connecta}"
required=(runtime health persistence backup_restore failover security edge_tls external_https)

for item in "${required[@]}"; do
  file="$EVIDENCE_DIR/$item.ok"
  [[ -s "$file" ]] || fail "missing evidence: $item"
  pass "evidence: $item"
done

for item in runtime health persistence backup_restore failover security edge_tls external_https; do
  file="$EVIDENCE_DIR/$item.ok"
  grep -q "release_sha=$IZAKHONO_RELEASE_SHA" "$file" || fail "evidence SHA mismatch: $item"
  grep -q "runtime_id=$IZAKHONO_RUNTIME_ID" "$file" || fail "runtime identity mismatch: $item"
  grep -q "runtime_provider=$IZAKHONO_RUNTIME_PROVIDER" "$file" || fail "runtime provider mismatch: $item"
done

pass "CONNECTA PRODUCTION GATES PASS"
echo "runtime_id=$IZAKHONO_RUNTIME_ID"
echo "runtime_provider=$IZAKHONO_RUNTIME_PROVIDER"
echo "release_sha=$IZAKHONO_RELEASE_SHA"
echo "physical_hardware_required=false"
echo "public_status=VERIFIED_BY_REQUIRED_EVIDENCE"
