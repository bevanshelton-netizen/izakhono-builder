#!/usr/bin/env bash
set -euo pipefail

# Regression tests for VERIFY-CONNECTA-LEGACY-PATH.sh.
# Fixtures are isolated in a temporary Git repository and never become
# production evidence or deployment artifacts.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
GUARD="$ROOT/infra/node-cluster/VERIFY-CONNECTA-LEGACY-PATH.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_fixture() {
  local dir="$1"
  mkdir -p "$dir/.github/workflows" "$dir/infra/node-cluster" "$dir/infra/runtime-fabric"
  cd "$dir"
  git init -q
  for file in \
    .github/workflows/connecta-ci.yml \
    .github/workflows/connecta-owned-runtime-certification.yml \
    .github/workflows/connecta-promotion-gate.yml \
    infra/node-cluster/CONNECTA-PROMOTION-GATE.sh \
    infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh \
    infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh \
    infra/runtime-fabric/CERTIFY-OWNED-RUNTIME-WAVE1.ps1; do
    : > "$file"
  done
  mkdir -p infra/runtime-fabric
  printf '%s\n' 'Deprecated: CERTIFY-WAVE1-OWNED.ps1' > infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md
}

# Logical node identifiers and historical documentation must remain allowed.
make_fixture "$tmp/allowed"
printf '%s\n' 'Require NODE01 NODE02 NODE03 NODE04 runtime health.' > "$tmp/allowed/.github/workflows/connecta-ci.yml"
(
  cd "$tmp/allowed"
  bash "$GUARD"
)

# A legacy launcher reference in a production workflow must block.
make_fixture "$tmp/blocked"
printf '%s\n' 'run: RUN-NODE01-WAVE1-LOCAL.cmd' > "$tmp/blocked/.github/workflows/connecta-promotion-gate.yml"
set +e
(
  cd "$tmp/blocked"
  bash "$GUARD"
) >/tmp/connecta-legacy-guard-test.out 2>&1
code=$?
set -e
if [[ "$code" -ne 10 ]]; then
  cat /tmp/connecta-legacy-guard-test.out >&2
  echo "[FAIL] legacy production dependency was not blocked (exit $code)" >&2
  exit 1
fi

echo "[PASS] legacy guard permits logical NODE01-NODE04 references and blocks retired launcher dependencies."
