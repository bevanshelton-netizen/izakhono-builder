#!/usr/bin/env bash
set -euo pipefail

# Canonical CONNECTA production-path contract. Legacy-path policy is delegated
# to VERIFY-CONNECTA-LEGACY-PATH.sh so one scanner remains authoritative.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

fail() {
  echo "[BLOCKED] $1" >&2
  exit 10
}

required_files=(
  "infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"
  "infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh"
  "infra/node-cluster/CONNECTA-PROMOTION-GATE.sh"
  "products/izakhono-social/engine/src/server.js"
  "products/izakhono-social/engine/src/node-health.js"
  "products/izakhono-social/docker-compose.owned.yml"
  ".github/workflows/connecta-owned-runtime-certification.yml"
  ".github/workflows/connecta-promotion-gate.yml"
  "infra/runtime-fabric/LEGACY-NODE01-WAVE1-DEPRECATION.md"
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || fail "required canonical CONNECTA production-path file is missing: $file"
done

workflow=".github/workflows/connecta-owned-runtime-certification.yml"
for node in NODE01 NODE02 NODE03 NODE04; do
  grep -q "$node" "$workflow" || fail "canonical certification workflow no longer declares $node"
done

grep -q 'VERIFY-NODE-CLUSTER-EVIDENCE.sh' "$workflow" || fail "canonical certification workflow no longer invokes the four-node evidence verifier"
grep -q 'CONNECTA-PROMOTION-GATE.sh' ".github/workflows/connecta-promotion-gate.yml" || fail "canonical promotion workflow no longer invokes the CONNECTA promotion gate"
promotion_workflow=".github/workflows/connecta-promotion-gate.yml"
for token in CONNECTA_NODE01_HEALTH_TOKEN CONNECTA_NODE02_HEALTH_TOKEN CONNECTA_NODE03_HEALTH_TOKEN CONNECTA_NODE04_HEALTH_TOKEN; do
  grep -q "$token" "$workflow" || fail "certification workflow is missing protected credential mapping: $token"
  grep -q "$token" "$promotion_workflow" || fail "promotion workflow is missing protected credential mapping: $token"
done
grep -q '/health/cluster' "products/izakhono-social/engine/src/server.js" || fail "CONNECTA engine no longer exposes the cluster health endpoint"
grep -q 'createNodeHealthChallenge' "products/izakhono-social/engine/src/server.js" || fail "CONNECTA engine no longer signs node health challenges"
grep -q 'bearer-hmac-sha256' "products/izakhono-social/engine/src/node-health.js" || fail "CONNECTA node health HMAC challenge contract is missing"
grep -q 'IZAKHONO_NODE_ID' "products/izakhono-social/docker-compose.owned.yml" || fail "owned runtime Compose does not pass logical node identity"
grep -q 'IZAKHONO_CLUSTER_ID' "products/izakhono-social/docker-compose.owned.yml" || fail "owned runtime Compose does not pass cluster identity"
grep -q 'IZAKHONO_NODE_HEALTH_TOKEN' "products/izakhono-social/docker-compose.owned.yml" || fail "owned runtime Compose does not pass the node health credential"
for token in CONNECTA_NODE01_HEALTH_TOKEN CONNECTA_NODE02_HEALTH_TOKEN CONNECTA_NODE03_HEALTH_TOKEN CONNECTA_NODE04_HEALTH_TOKEN; do
  grep -q "$token" "$workflow" || fail "certification workflow is missing protected credential mapping: $token"
done

echo "[PASS] CONNECTA production path and four-node certification contract are intact. Run VERIFY-CONNECTA-LEGACY-PATH.sh as the separate legacy regression gate."
