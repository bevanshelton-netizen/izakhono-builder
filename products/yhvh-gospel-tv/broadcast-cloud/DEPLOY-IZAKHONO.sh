#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }

mkdir -p vault data/hls

if [[ ! -f .env ]]; then
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 32)"
    sed -i.bak "s/^YHVH_CONTROL_TOKEN=.*/YHVH_CONTROL_TOKEN=${TOKEN}/" .env
    rm -f .env.bak
  fi
  echo "Created .env. Review it before production use."
fi

echo "Starting YHVH Broadcast Cloud..."
docker compose up -d --build

echo
printf '%s\n' 'YHVH Broadcast Cloud started.'
printf '%s\n' 'Next: place cleared Gospel media in ./vault, register it in the owner Control Center, complete rights/QC/territory approval, then verify /health and /hls/playlist.m3u8.'
