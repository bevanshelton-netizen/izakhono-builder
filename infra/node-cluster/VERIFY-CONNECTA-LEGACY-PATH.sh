#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production guard: retired physical/workstation NODE01 activation
# paths must never be invoked by a workflow, product runtime, or active
# infrastructure entrypoint. Historical documentation and the retired files
# themselves are deliberately excluded.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

forbidden=(
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

excluded=(
  'VERIFY-CONNECTA-LEGACY-PATH.sh'
  'test-connecta-legacy-path-guard.sh'
  'CERTIFY-WAVE1-OWNED.ps1'
  'PUSH-WAVE1-OWNED.ps1'
  'RUN-NODE01-WAVE1-LOCAL.cmd'
  'IZAKHONO-NODE01-WAVE1-REPORT.json'
)

scan_roots=(
  '.github/workflows'
  'products/izakhono-social'
  'products/izakhono-node'
  'infra/node-cluster'
  'infra/runtime-fabric'
  'infra/public-cutover'
)

scan_extensions=(
  '*.yml' '*.yaml' '*.sh' '*.ps1' '*.cmd' '*.bat'
  '*.js' '*.mjs' '*.cjs' '*.ts' '*.tsx' '*.json'
)

files=()
for root in "${scan_roots[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    skip=false
    for name in "${excluded[@]}"; do
      [[ "$base" == "$name" ]] && skip=true && break
    done
    [[ "$skip" == true ]] || files+=("$file")
  done < <(find "$root" -type f \( $(printf -- '-o -name %q ' "${scan_extensions[@]}" | sed 's/^-o /-name /') \) -print0 2>/dev/null)
done

for path in "${files[@]}"; do
  for token in "${forbidden[@]}"; do
    if grep -Fq -- "$token" "$path"; then
      echo "[BLOCKED] CONNECTA production surface references deprecated legacy path: $token in $path" >&2
      exit 10
    fi
  done
done

echo "[PASS] scanned ${#files[@]} active workflow, product and infrastructure files; no legacy physical-NODE01 production dependency found."
