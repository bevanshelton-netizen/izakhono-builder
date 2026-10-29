#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production must never depend on the deprecated physical/workstation NODE01 gate.
# The legacy implementation may remain in the repository for historical compatibility,
# but it must not be referenced by CONNECTA production workflows or promotion controls.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FORBIDDEN=(
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

# Only inspect files that can actually define or enforce CONNECTA production behavior.
TARGETS=(
  "$ROOT/.github/workflows"
  "$ROOT/infra/node-cluster/CONNECTA-PROMOTION-GATE.sh"
  "$ROOT/infra/node-cluster/CONNECTA-RUNTIME-CERTIFICATION-README.md"
  "$ROOT/infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1"
  "$ROOT/products/izakhono-social/.izakhono.json"
)

for forbidden in "${FORBIDDEN[@]}"; do
  for target in "${TARGETS[@]}"; do
    [[ -e "$target" ]] || continue
    if grep -R -n -F -- "$forbidden" "$target" 2>/dev/null | grep -v 'LEGACY-NODE01-WAVE1-DEPRECATION.md' >/tmp/connecta-legacy-hit.txt; then
      echo "[BLOCKED] CONNECTA production control references deprecated legacy gate: $forbidden" >&2
      cat /tmp/connecta-legacy-hit.txt >&2
      rm -f /tmp/connecta-legacy-hit.txt
      exit 10
    fi
  done
done

rm -f /tmp/connecta-legacy-hit.txt
echo "[PASS] CONNECTA production controls contain no deprecated physical-NODE01 gate dependency."
