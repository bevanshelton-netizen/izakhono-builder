#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production guard: legacy physical/workstation NODE01 flows must not
# become production dependencies again.
# This is a source-policy check, not runtime evidence.

forbidden_paths=(
  'infra/runtime-fabric/CERTIFY-WAVE1-OWNED.ps1'
  'infra/public-cutover/PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'RUN-NODE01-WAVE1-CONTINUE.cmd'
)

forbidden_patterns=(
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'RUN-NODE01-WAVE1-CONTINUE.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

# Documentation explaining the deprecation is explicitly allowed.
allowed_docs=(
  'infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md'
  'infra/node-cluster/CONNECTA-RUNTIME-CERTIFICATION-README.md'
)

for path in "${forbidden_paths[@]}"; do
  if [[ -f "$path" ]]; then
    echo "[INFO] legacy artifact retained for historical compatibility: $path"
  fi
done

# Search only production automation/configuration areas. Ignore the explicit
# deprecation/README documents because they must name the retired flow.
search_roots=(
  '.github/workflows'
  'infra/node-cluster'
  'products/izakhono-social'
)

for pattern in "${forbidden_patterns[@]}"; do
  for root in "${search_roots[@]}"; do
    [[ -d "$root" ]] || continue
    while IFS= read -r file; do
      skip=false
      for allowed in "${allowed_docs[@]}"; do
        [[ "$file" == "$allowed" ]] && skip=true
      done
      $skip && continue
      echo "[BLOCKED] CONNECTA production automation references deprecated NODE01 flow: $file -> $pattern" >&2
      exit 10
    done < <(grep -RIl --exclude-dir=.git --fixed-strings "$pattern" "$root" 2>/dev/null || true)
  done
done

echo '[PASS] CONNECTA production automation contains no deprecated physical-NODE01 dependency.'
