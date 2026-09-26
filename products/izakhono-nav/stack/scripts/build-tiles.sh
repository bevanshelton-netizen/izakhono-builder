#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$HERE/.env" ]] && set -a && source "$HERE/.env" && set +a
RAW_DATA_DIR="${NAV_DATA_DIR:-runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then DATA_DIR="$RAW_DATA_DIR"; else DATA_DIR="$HERE/$RAW_DATA_DIR"; fi
PBF="$DATA_DIR/osm/south-africa-latest.osm.pbf"
OUT="$DATA_DIR/tiles/south-africa.pmtiles"
STORE="$DATA_DIR/tilemaker-store"
[[ -f "$PBF" ]] || { echo "Missing $PBF. Run bootstrap-data.sh first." >&2; exit 2; }
mkdir -p "$(dirname "$OUT")" "$STORE"
rm -f "$OUT.part"
docker run --rm   -v "$DATA_DIR:/data"   ghcr.io/systemed/tilemaker:master   /data/osm/south-africa-latest.osm.pbf   --output /data/tiles/south-africa.pmtiles.part   --store /data/tilemaker-store
mv "$TMP" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "Built $OUT"
