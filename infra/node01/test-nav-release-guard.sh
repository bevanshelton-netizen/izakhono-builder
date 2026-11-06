#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROMOTE="$ROOT/infra/node01/node01-promote-release.sh"
MARKER="${TMPDIR:-/tmp}/nav-release-guard-should-not-exist-$$"
trap 'rm -f "$MARKER"' EXIT

expect_rejected() {
  local value="$1" code=0
  bash "$PROMOTE" "$value" >/dev/null 2>&1 || code=$?
  [[ "$code" -eq 30 ]] || {
    echo "ERROR: malformed release SHA was not rejected at input validation (exit=$code)" >&2
    exit 1
  }
}

expect_rejected ""
expect_rejected "abc"
expect_rejected "000000000000000000000000000000000000000"
expect_rejected "00000000000000000000000000000000000000000"
expect_rejected "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
expect_rejected '$(touch '"$MARKER"')'
[[ ! -e "$MARKER" ]] || { echo "ERROR: release input was evaluated by the shell" >&2; exit 1; }

echo "NAV release guard tests PASS: empty, malformed, wrong-length, uppercase and shell-expression inputs rejected"
