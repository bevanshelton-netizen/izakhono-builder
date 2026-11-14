#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible entrypoint retained for older automation.
# All CONNECTA legacy-path policy is maintained by one canonical scanner.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "$ROOT/infra/node-cluster/VERIFY-CONNECTA-LEGACY-PATH.sh"
