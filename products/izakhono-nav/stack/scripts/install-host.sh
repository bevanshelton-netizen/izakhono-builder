#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root: sudo $0" >&2; exit 2; fi
if ! command -v apt-get >/dev/null; then echo "This installer currently supports Debian/Ubuntu hosts." >&2; exit 3; fi
apt-get update
apt-get install -y ca-certificates curl docker.io
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin
fi
systemctl enable --now docker
echo "IZAKHONO runtime host prerequisites installed."
echo "Docker: $(docker --version)"
docker compose version
