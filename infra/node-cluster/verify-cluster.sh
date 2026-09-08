#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run on NODE 01 as root." >&2
  exit 2
fi
command -v k3s >/dev/null || { echo "k3s not found." >&2; exit 2; }

EXPECTED=(node01 node02 node03 node04)
JSON="$(k3s kubectl get nodes -o json)"

for node in "${EXPECTED[@]}"; do
  if ! grep -q "\"name\": \"$node\"" <<<"$JSON"; then
    echo "FAIL: $node missing from cluster" >&2
    exit 4
  fi

  ready="$(k3s kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')"
  if [[ "$ready" != "True" ]]; then
    echo "FAIL: $node is not Ready" >&2
    exit 4
  fi
done

servers="$(k3s kubectl get nodes -l node-role.kubernetes.io/control-plane -o name | wc -l | tr -d ' ')"
if [[ "$servers" -lt 3 ]]; then
  echo "FAIL: expected at least 3 control-plane nodes, found $servers" >&2
  exit 5
fi

if [[ ! -d /var/lib/rancher/k3s/server/db/snapshots ]]; then
  echo "FAIL: etcd snapshot directory missing" >&2
  exit 6
fi

echo "IZAKHONO_NODE_CLUSTER=PASS"
echo "NODES=4"
echo "CONTROL_PLANE=$servers"
echo "PRIMARY=node01"
echo "FAILOVER_ORDER=node02,node03,node04"
echo "NOTE=Real failover, restore, UPS and public-edge tests are still required before production sign-off."
