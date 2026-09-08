#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${IZAKHONO_CLUSTER_ENV:-/etc/izakhono/node-cluster.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy cluster.env.example and populate it first." >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 2
fi

required=(NODE01_NAME NODE01_IP IZAKHONO_DATA_ROOT)
for var in "${required[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required variable: $var" >&2
    exit 2
  fi
done

hostnamectl set-hostname "$NODE01_NAME"
timedatectl set-timezone "${IZAKHONO_TIMEZONE:-Africa/Johannesburg}"
mkdir -p "$IZAKHONO_DATA_ROOT" /etc/rancher/k3s /var/lib/rancher/k3s/server/db/snapshots
chmod 700 /var/lib/rancher/k3s/server/db/snapshots

cat >/etc/rancher/k3s/config.yaml <<CFG
node-name: $NODE01_NAME
node-ip: $NODE01_IP
advertise-address: $NODE01_IP
write-kubeconfig-mode: "0600"
secrets-encryption: true
flannel-backend: wireguard-native
disable:
  - traefik
cluster-init: true
etcd-snapshot-schedule-cron: "0 */6 * * *"
etcd-snapshot-retention: 28
etcd-snapshot-dir: /var/lib/rancher/k3s/server/db/snapshots
CFG

curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server" sh -

systemctl enable --now k3s
until k3s kubectl get --raw=/readyz >/dev/null 2>&1; do sleep 2; done

echo
echo "NODE 01 bootstrap complete."
echo "Join token:"
cat /var/lib/rancher/k3s/server/node-token
echo
echo "Kubeconfig: /etc/rancher/k3s/k3s.yaml"
