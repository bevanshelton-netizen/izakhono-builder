#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible entrypoint retained for existing automation.
# The canonical CONNECTA-only scanner owns the policy and test coverage.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "$ROOT/infra/node-cluster/VERIFY-CONNECTA-LEGACY-PATH.sh"
