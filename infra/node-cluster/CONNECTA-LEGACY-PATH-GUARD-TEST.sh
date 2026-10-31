#!/usr/bin/env bash
set -euo pipefail

# Test the CONNECTA legacy-path guard without creating fake runtime evidence.
# The guard must pass when deprecated references exist only in explicitly
# allowed historical/deprecation documentation.

bash infra/node-cluster/CONNECTA-LEGACY-PATH-GUARD.sh
