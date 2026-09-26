#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
"$HERE/scripts/preflight.sh"
set -a; source "$HERE/.env"; set +a
RAW_DATA_DIR="${NAV_DATA_DIR:-runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then DATA_DIR="$RAW_DATA_DIR"; else DATA_DIR="$HERE/$RAW_DATA_DIR"; fi
if [[ ! -f "$DATA_DIR/osm/south-africa-latest.osm.pbf" ]]; then "$HERE/scripts/bootstrap-data.sh"; fi
if [[ ! -f "$DATA_DIR/tiles/south-africa.pmtiles" ]]; then "$HERE/scripts/build-tiles.sh"; fi
echo "Starting IZAKHONO NAV owned services..."
docker compose --env-file "$HERE/.env" -f "$HERE/compose.yaml" up -d --build
echo "Services started."
echo "Valhalla and Nominatim may still be building/importing their South Africa datasets."
echo "Use: $HERE/scripts/status.sh"
echo "Then: $HERE/scripts/verify.sh"
