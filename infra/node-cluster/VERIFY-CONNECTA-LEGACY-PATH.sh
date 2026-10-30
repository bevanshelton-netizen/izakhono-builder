#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production guard: legacy physical-NODE01 activation paths must never
# become production dependencies again. Documentation may describe them, but
# authoritative CONNECTA workflows/gates must not invoke or depend on them.

forbidden=(
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

# Only inspect authoritative CONNECTA execution surfaces. The deprecation and
# certification documentation are intentionally excluded because they must name
# the retired paths to prevent accidental reuse.
paths=(
  '.github/workflows/connecta-ci.yml'
  '.github/workflows/connecta-owned-runtime-certification.yml'
  '.github/workflows/connecta-promotion-gate.yml'
  'infra/node-cluster/CONNECTA-PROMOTION-GATE.sh'
  'infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh'
  'infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh'
  'infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1'
)

for path in "${paths[@]}"; do
  [[ -f "$path" ]] || continue
  for token in "${forbidden[@]}"; do
    if grep -Fq "$token" "$path"; then
      echo "[BLOCKED] CONNECTA production surface references deprecated legacy path: $token in $path" >&2
      exit 10
    fi
  done
done

echo "[PASS] CONNECTA production surfaces contain no legacy physical-NODE01 activation dependency."
