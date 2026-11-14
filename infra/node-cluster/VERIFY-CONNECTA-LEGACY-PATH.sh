#!/usr/bin/env bash
set -euo pipefail

# CONNECTA-only production guard. Retired physical/workstation NODE01
# activation paths must not be invoked by CONNECTA workflows, CONNECTA product
# code, or the canonical node-cluster certification entrypoints. Unrelated
# product workflows (for example KORA/Allegro Wave 1) are outside this guard.

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
  'products/izakhono-social'
  'infra/node-cluster'
)

scan_extensions=(
  '*.yml' '*.yaml' '*.sh' '*.ps1' '*.cmd' '*.bat'
  '*.js' '*.mjs' '*.cjs' '*.ts' '*.tsx' '*.json'
)

find_args=()
for pattern in "${scan_extensions[@]}"; do
  if [[ "${#find_args[@]}" -gt 0 ]]; then find_args+=(-o); fi
  find_args+=(-name "$pattern")
done

files=()
# Only workflow files that actually own or invoke CONNECTA are in scope.
if [[ -d .github/workflows ]]; then
  while IFS= read -r -d '' file; do
    if grep -Eiq 'CONNECTA|products/izakhono-social|CONNECTA_NODE0[1-4]_URL' "$file"; then
      files+=("$file")
    fi
  done < <(find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 2>/dev/null)
fi

for root in "${scan_roots[@]}"; do
  [[ -d "$root" ]] || continue
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    skip=false
    for name in "${excluded[@]}"; do
      [[ "$base" == "$name" ]] && skip=true && break
    done
    [[ "$skip" == true ]] || files+=("$file")
  done < <(find "$root" -type f \( "${find_args[@]}" \) -print0 2>/dev/null)
done

# This shared-runtime certification script is explicitly the CONNECTA-owned
# runtime integration point. Other runtime-fabric workflows may serve separate
# products and are not silently reclassified as CONNECTA dependencies.
shared_certifier='infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1'
[[ ! -f "$shared_certifier" ]] || files+=("$shared_certifier")

for path in "${files[@]}"; do
  for token in "${forbidden[@]}"; do
    if grep -Fq -- "$token" "$path"; then
      echo "[BLOCKED] CONNECTA production surface references deprecated legacy path: $token in $path" >&2
      exit 10
    fi
  done
done

echo "[PASS] scanned ${#files[@]} CONNECTA workflow, product and node-cluster files; no legacy physical-NODE01 dependency found."
