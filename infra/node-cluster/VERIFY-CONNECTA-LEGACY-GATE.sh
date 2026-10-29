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

# These files are intentionally allowed to describe/deprecate the legacy flow.
allowed_docs=(
  'infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md'
  'infra/node-cluster/CONNECTA-RUNTIME-CERTIFICATION-README.md'
)

is_allowed_doc() {
  local file="$1"
  for allowed in "${allowed_docs[@]}"; do
    [[ "$file" == "$ROOT/$allowed" ]] && return 0
  done
  return 1
}

check_file() {
  local file="$1"
  is_allowed_doc "$file" && return 0

  for token in "${forbidden[@]}"; do
    if grep -nF -- "$token" "$file" >/dev/null 2>&1; then
      echo "[BLOCKED] legacy CONNECTA production dependency detected: $token in ${file#$ROOT/}" >&2
      grep -nF -- "$token" "$file" >&2 || true
      return 10
    fi
  done
}

status=0
while IFS= read -r -d '' file; do
  if ! check_file "$file"; then
    status=10
  fi
done < <(
  find "$ROOT/.github/workflows" "$ROOT/infra/node-cluster" "$ROOT/infra/runtime-fabric" \
    -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.sh' -o -name '*.ps1' -o -name '*.cmd' -o -name '*.json' \) \
    -print0
)

if [[ "$status" -ne 0 ]]; then
  exit 10
fi

echo "[PASS] CONNECTA production paths contain no legacy physical-NODE01 dependency."
