#!/usr/bin/env bash
set -euo pipefail

# Canonical CONNECTA production-path contract. Legacy-path policy is delegated
# to VERIFY-CONNECTA-LEGACY-PATH.sh so one scanner remains authoritative.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
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

workflow=".github/workflows/connecta-owned-runtime-certification.yml"
for node in NODE01 NODE02 NODE03 NODE04; do
  grep -q "$node" "$workflow" || fail "canonical certification workflow no longer declares $node"
done

grep -q 'VERIFY-NODE-CLUSTER-EVIDENCE.sh' "$workflow" || fail "canonical certification workflow no longer invokes the four-node evidence verifier"
grep -q 'CONNECTA-PROMOTION-GATE.sh' ".github/workflows/connecta-promotion-gate.yml" || fail "canonical promotion workflow no longer invokes the CONNECTA promotion gate"

bash infra/node-cluster/VERIFY-CONNECTA-LEGACY-PATH.sh

echo "[PASS] CONNECTA production path and four-node certification contract are intact."
