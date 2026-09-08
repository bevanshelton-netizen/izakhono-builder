#!/usr/bin/env bash
set -euo pipefail

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root on NODE 01." >&2; exit 2; }
command -v k3s >/dev/null || { echo "k3s is required." >&2; exit 2; }

SELF="$(hostname -s)"
if [[ "$SELF" != "node01" ]]; then
  echo "Run this installer on node01 only; current host is $SELF." >&2
  exit 3
fi

for node in node01 node02 node03 node04; do
  ready="$(k3s kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
  [[ "$ready" == "True" ]] || { echo "Node $node is not Ready." >&2; exit 4; }
done

mkdir -p /srv/izakhono/longhorn
chmod 700 /srv/izakhono/longhorn

MANIFEST_DIR=/var/lib/rancher/k3s/server/manifests
SOURCE="$(cd "$(dirname "$0")" && pwd)/longhorn-1.12.1.yaml"
[[ -f "$SOURCE" ]] || { echo "Missing $SOURCE" >&2; exit 5; }

install -m 0600 "$SOURCE" "$MANIFEST_DIR/izakhono-longhorn.yaml"

echo "Waiting for Longhorn namespace..."
for _ in $(seq 1 90); do
  if k3s kubectl get namespace longhorn-system >/dev/null 2>&1; then break; fi
  sleep 2
done

k3s kubectl get namespace longhorn-system >/dev/null

echo "Waiting for Longhorn manager DaemonSet..."
k3s kubectl -n longhorn-system rollout status daemonset/longhorn-manager --timeout=10m

echo "IZAKHONO_DATA_INSTALL=PASS"
echo "Run verify-storage.sh next."
