#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0

check() {
  local label="$1"; shift
  if "$@"; then
    echo "[PASS] $label"
  else
    echo "[FAIL] $label"
    fail=1
  fi
}

command -v docker >/dev/null 2>&1 && echo "[PASS] Docker available" || { echo "[FAIL] Docker unavailable"; fail=1; }
command -v docker >/dev/null 2>&1 && check "Compose configuration" docker compose -f "$ROOT/docker-compose.yml" config -q
check "Runtime contract" node "$ROOT/test.mjs"

for f in \
  node01.spec.json \
  node01-services.json \
  backup-policy.json \
  monitoring-policy.json \
  deployment-policy.json \
  workload-state.schema.json \
  node-cluster.json \
  heartbeat-policy.json \
  node02-replication-policy.json \
  node01-network-topology.json \
  node01-storage-layout.json \
  node01-hardware-profile.json; do
  check "JSON valid: $f" node -e "JSON.parse(require('fs').readFileSync('$ROOT/$f','utf8'))"
done

for f in backup-node01.sh restore-node01.sh node01-install.sh node01-ops-health.sh node01-ops-install.sh deploy-super-seo.sh rollback-super-seo.sh promote-super-seo-to-local-registry.sh; do
  check "Shell syntax: $f" bash -n "$ROOT/$f"
done

if [[ "$fail" -ne 0 ]]; then
  echo "[STOP] NODE01 platform acceptance failed."
  exit 1
fi

echo "[PASS] NODE01 platform acceptance contract is green."
