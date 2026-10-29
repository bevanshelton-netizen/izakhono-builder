#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production guard: legacy physical/workstation NODE01 flows are
# documentation-only and must never become production certification inputs.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

forbidden=(
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

# Only authoritative production/control surfaces are scanned. Historical
# scripts and deprecation documentation are intentionally outside this set.
production_files=(
  "$ROOT/.github/workflows/connecta-ci.yml"
  "$ROOT/.github/workflows/connecta-owned-runtime-certification.yml"
  "$ROOT/.github/workflows/connecta-promotion-gate.yml"
  "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"
  "$ROOT/infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh"
  "$ROOT/infra/node-cluster/CONNECTA-PROMOTION-GATE.sh"
  "$ROOT/infra/node-cluster/VERIFY-CONNECTA-PRODUCTION-PATH.sh"
  "$ROOT/products/izakhono-social/.izakhono.json"
)

for file in "${production_files[@]}"; do
  [[ -f "$file" ]] || { echo "[BLOCKED] missing production surface: ${file#$ROOT/}" >&2; exit 10; }
  for token in "${forbidden[@]}"; do
    if grep -nF -- "$token" "$file" >/dev/null 2>&1; then
      echo "[BLOCKED] legacy CONNECTA production dependency detected: $token in ${file#$ROOT/}" >&2
      grep -nF -- "$token" "$file" >&2 || true
      exit 10
    fi
  done
done

echo "[PASS] CONNECTA authoritative production surfaces contain no legacy physical-NODE01 dependency."
