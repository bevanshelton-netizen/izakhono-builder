#!/usr/bin/env bash
set -euo pipefail

# CI/release guard: prevent CONNECTA production certification from regressing
# to the deprecated physical/workstation NODE01 flow.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
cd "$ROOT"

fail() {
  echo "[BLOCKED] $1" >&2
  exit 10
}

required_files=(
  "infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"
  "infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh"
  "infra/node-cluster/CONNECTA-PROMOTION-GATE.sh"
  ".github/workflows/connecta-owned-runtime-certification.yml"
  ".github/workflows/connecta-promotion-gate.yml"
  "infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md"
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || fail "required canonical CONNECTA production-path file is missing: $file"
done

# The deprecated scripts may exist for historical compatibility, but they must
# never be referenced by CONNECTA production workflows as a certification gate.
for workflow in ".github/workflows/connecta-owned-runtime-certification.yml" ".github/workflows/connecta-promotion-gate.yml"; do
  if grep -nE 'CERTIFY-WAVE1-OWNED\.ps1|PUSH-WAVE1-OWNED\.ps1|RUN-NODE01-WAVE1-LOCAL\.cmd' "$workflow" >/tmp/connecta-legacy-match 2>/dev/null; then
    cat /tmp/connecta-legacy-match >&2
    fail "CONNECTA production workflow references deprecated physical-NODE01 flow: $workflow"
  fi
done

# Canonical four-node requirements must remain explicit in the certification
# workflow. This is an anti-regression guard, not runtime evidence.
workflow=".github/workflows/connecta-owned-runtime-certification.yml"
for node in NODE01 NODE02 NODE03 NODE04; do
  grep -q "$node" "$workflow" || fail "canonical certification workflow no longer declares $node"
done

grep -q 'VERIFY-NODE-CLUSTER-EVIDENCE.sh' "$workflow" || fail "canonical certification workflow no longer invokes the four-node evidence verifier"
grep -q 'CONNECTA-PROMOTION-GATE.sh' ".github/workflows/connecta-promotion-gate.yml" || fail "canonical promotion workflow no longer invokes the CONNECTA promotion gate"

echo "[PASS] CONNECTA production path is protected from legacy physical-NODE01 regression."
