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

if [[ ! -f runtime/data/broadcast-inputs.json ]]; then
  cp playout/broadcast-inputs.json runtime/data/broadcast-inputs.json
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required on the broadcast host."
  exit 1
fi

# Caddy obtains and renews TLS automatically once DNS points YHVH_PUBLIC_DOMAIN at this host.
docker compose -f docker-compose.broadcast-cloud.yml up -d --build

echo
printf '%s\n' 'YHVH BROADCAST CLOUD STARTED'
echo '--------------------------------'
docker compose -f docker-compose.broadcast-cloud.yml ps
echo
echo 'Health:      https://${YHVH_PUBLIC_DOMAIN}/health'
echo 'HLS:         https://${YHVH_PUBLIC_DOMAIN}/hls/playlist.m3u8'
echo 'Broadcast:   https://${YHVH_PUBLIC_DOMAIN}/broadcast'
echo
echo 'The encoder will use the station-owned standby slate until cleared content is present.'
echo 'Do not call the channel fully programmed/live until the HLS stream is independently verified.'
