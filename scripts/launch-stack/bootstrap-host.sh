#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

HARDEN=false
if [ "${1:-}" = '--harden' ]; then HARDEN=true; fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl jq openssl gzip tar ufw docker.io

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose-plugin 2>/dev/null || true
fi
if ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Compose v2 is required. Install the Compose plugin and re-run.'
  exit 1
fi

systemctl enable --now docker
install -d -m 0750 /opt/izakhono/{launch-stack,secrets,state,backups}

if [ "$HARDEN" = true ]; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo '[PASS] Docker host prerequisites installed.'
echo 'No SSH credentials or production secrets were requested or stored.'
