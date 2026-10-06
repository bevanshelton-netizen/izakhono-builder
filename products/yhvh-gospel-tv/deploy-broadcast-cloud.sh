#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env.broadcast ]]; then
  echo "ERROR: .env.broadcast is required. Copy .env.broadcast.example and set YHVH_CONTROL_TOKEN and YHVH_PUBLIC_DOMAIN."
  exit 1
fi

mkdir -p runtime/content-vault runtime/data
chmod 700 runtime runtime/content-vault runtime/data
[[ -f runtime/data/broadcast-inputs.json ]] || cp playout/broadcast-inputs.json runtime/data/broadcast-inputs.json

command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is required on the broadcast host."; exit 1; }

docker compose -f docker-compose.broadcast-cloud.yml up -d --build

echo "YHVH BROADCAST CLOUD DEPLOYED"
echo "Health:    https://${YHVH_PUBLIC_DOMAIN}/health"
echo "HLS:       https://${YHVH_PUBLIC_DOMAIN}/hls/playlist.m3u8"
echo "Player:    https://${YHVH_PUBLIC_DOMAIN}/"
echo "Console:   https://${YHVH_PUBLIC_DOMAIN}/broadcast"
echo ""
echo "Next gate: place cleared media in runtime/content-vault, register it, pass QC, clear ZA, then start the encoder."
