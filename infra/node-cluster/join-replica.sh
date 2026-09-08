#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "server" && "$MODE" != "worker" ]]; then
  echo "Usage: sudo ./join-replica.sh server|worker" >&2
  exit 2
fi

ENV_FILE="${IZAKHONO_CLUSTER_ENV:-/etc/izakhono/node-cluster.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE." >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 2
fi

if [[ -z "${K3S_PRIMARY_URL:-}" || -z "${K3S_TOKEN:-}" ]]; then
  echo "K3S_PRIMARY_URL and K3S_TOKEN are required." >&2
  exit 2
fi

SELF_IP="$(hostname -I | awk '{print $1}')"
case "$SELF_IP" in
  "$NODE02_IP") SELF_NAME="$NODE02_NAME" ;;
  "$NODE03_IP") SELF_NAME="$NODE03_NAME" ;;
  "$NODE04_IP") SELF_NAME="$NODE04_NAME" ;;
  *)
    echo "This machine IP ($SELF_IP) does not match NODE02_IP, NODE03_IP or NODE04_IP." >&2
    exit 3
    ;;
esac

hostnamectl set-hostname "$SELF_NAME"
timedatectl set-timezone "${IZAKHONO_TIMEZONE:-Africa/Johannesburg}"
mkdir -p "${IZAKHONO_DATA_ROOT:-/srv/izakhono}" /etc/rancher/k3s

if [[ "$MODE" == "server" ]]; then
  if [[ "$SELF_NAME" == "$NODE04_NAME" ]]; then
    echo "NODE 04 is intentionally a worker/DR node, not an etcd voter." >&2
    exit 3
  fi

  cat >/etc/rancher/k3s/config.yaml <<CFG
server: $K3S_PRIMARY_URL
token: $K3S_TOKEN
node-name: $SELF_NAME
node-ip: $SELF_IP
advertise-address: $SELF_IP
write-kubeconfig-mode: "0600"
secrets-encryption: true
flannel-backend: wireguard-native
disable:
  - traefik
etcd-snapshot-schedule-cron: "0 */6 * * *"
etcd-snapshot-retention: 28
CFG

  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server" sh -
  systemctl enable --now k3s
  until k3s kubectl get --raw=/readyz >/dev/null 2>&1; do sleep 2; done
else
  if [[ "$SELF_NAME" != "$NODE04_NAME" ]]; then
    echo "NODE 02 and NODE 03 must join as server control-plane replicas." >&2
    exit 3
  fi

  curl -sfL https://get.k3s.io |     K3S_URL="$K3S_PRIMARY_URL"     K3S_TOKEN="$K3S_TOKEN"     INSTALL_K3S_EXEC="agent --node-name $SELF_NAME --node-ip $SELF_IP" sh -

  systemctl enable --now k3s-agent
fi

echo "$SELF_NAME joined IZAKHONO NODE CLUSTER as $MODE."
