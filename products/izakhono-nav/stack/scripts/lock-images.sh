#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
images=(
  "ghcr.io/valhalla/valhalla-scripted:latest"
  "mediagis/nominatim:5.3"
  "ghcr.io/maplibre/martin:1.16.1-full"
  "ghcr.io/systemed/tilemaker:master"
  "caddy:2-alpine"
)
: > "$HERE/image-lock.txt"
for img in "${images[@]}"; do
  docker pull "$img" >/dev/null
  digest="$(docker image inspect "$img" --format '{{index .RepoDigests 0}}')"
  printf '%s\n' "$digest" | tee -a "$HERE/image-lock.txt"
done
