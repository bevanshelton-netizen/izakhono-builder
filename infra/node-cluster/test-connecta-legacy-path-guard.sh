#!/usr/bin/env bash
set -euo pipefail

# Regression tests for VERIFY-CONNECTA-LEGACY-PATH.sh. Fixtures are isolated
# temporary repositories and are never production evidence or deployment inputs.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GUARD="$ROOT/infra/node-cluster/VERIFY-CONNECTA-LEGACY-PATH.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_fixture() {
  local dir="$1"
  mkdir -p "$dir/.github/workflows" "$dir/infra/node-cluster" \
    "$dir/infra/runtime-fabric" "$dir/products/izakhono-social/scripts"
  cd "$dir"
  git init -q
  for file in \
    .github/workflows/connecta-ci.yml \
    .github/workflows/connecta-owned-runtime-certification.yml \
    .github/workflows/connecta-promotion-gate.yml \
    infra/node-cluster/CONNECTA-PROMOTION-GATE.sh \
    infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh \
    infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh \
    infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1 \
    products/izakhono-social/scripts/runtime.js; do
    : > "$file"
  done
  printf '%s\n' 'Deprecated: CERTIFY-WAVE1-OWNED.ps1' > infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md
}

run_guard_expect() {
  local dir="$1" expected="$2" output="$tmp/guard.out" code
  set +e
  (cd "$dir" && bash "$GUARD") >"$output" 2>&1
  code=$?
  set -e
  if [[ "$code" -ne "$expected" ]]; then
    cat "$output" >&2
    echo "[FAIL] expected guard exit $expected, got $code for $dir" >&2
    exit 1
  fi
}

# Logical node identifiers and historical documentation must remain allowed.
make_fixture "$tmp/allowed"
printf '%s\n' 'Require NODE01 NODE02 NODE03 NODE04 runtime health.' > "$tmp/allowed/.github/workflows/connecta-ci.yml"
run_guard_expect "$tmp/allowed" 0

# A legacy launcher in any CONNECTA workflow must block.
make_fixture "$tmp/workflow-blocked"
printf '%s\n' 'name: CONNECTA Deploy' 'run: RUN-NODE01-WAVE1-LOCAL.cmd' > "$tmp/workflow-blocked/.github/workflows/connecta-deploy.yml"
run_guard_expect "$tmp/workflow-blocked" 10

# Unrelated product workflows retain their own lifecycle and are not reclassified.
make_fixture "$tmp/unrelated-workflow"
printf '%s\n' 'run: CERTIFY-WAVE1-OWNED.ps1' > "$tmp/unrelated-workflow/.github/workflows/runtime-fabric-ci.yml"
run_guard_expect "$tmp/unrelated-workflow" 0

# A legacy report dependency in CONNECTA product runtime code must block.
make_fixture "$tmp/product-blocked"
printf '%s\n' 'readFile("IZAKHONO-NODE01-WAVE1-REPORT.json")' > "$tmp/product-blocked/products/izakhono-social/scripts/runtime.js"
run_guard_expect "$tmp/product-blocked" 10

# Infrastructure certification scripts are production surfaces too.
make_fixture "$tmp/infra-blocked"
printf '%s\n' 'powershell CERTIFY-WAVE1-OWNED.ps1' > "$tmp/infra-blocked/infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1"
run_guard_expect "$tmp/infra-blocked" 10

echo "[PASS] CONNECTA guard allows logical nodes and unrelated product workflows, while blocking legacy CONNECTA workflow, product-runtime and infrastructure dependencies."
