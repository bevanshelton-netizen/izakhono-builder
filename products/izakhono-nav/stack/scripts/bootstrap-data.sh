#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$HERE/.env"
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a
RAW_DATA_DIR="${NAV_DATA_DIR:-runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then DATA_DIR="$RAW_DATA_DIR"; else DATA_DIR="$HERE/$RAW_DATA_DIR"; fi
PBF_URL="https://download.geofabrik.de/africa/south-africa-latest.osm.pbf"
MD5_URL="${PBF_URL}.md5"
mkdir -p "$DATA_DIR/osm" "$DATA_DIR/router" "$DATA_DIR/tiles" "$DATA_DIR/tilemaker-store"
PBF="$DATA_DIR/osm/south-africa-latest.osm.pbf"
TMP="$PBF.part"
echo "Downloading South Africa OSM extract..."
curl -fL --retry 5 --retry-delay 3 -o "$TMP" "$PBF_URL"
curl -fL --retry 5 --retry-delay 3 -o "$PBF.md5.remote" "$MD5_URL"
mv "$TMP" "$PBF"
expected="$(awk '{print $1}' "$PBF.md5.remote" | head -n1)"
actual="$(md5sum "$PBF" | awk '{print $1}')"
if [[ -z "$expected" || "$actual" != "$expected" ]]; then
  echo "OSM checksum mismatch: expected=$expected actual=$actual" >&2
  exit 2
fi
printf '%s  %s\n' "$actual" "$(basename "$PBF")" > "$DATA_DIR/osm/south-africa-latest.osm.pbf.md5"
ln -f "$PBF" "$DATA_DIR/router/south-africa-latest.osm.pbf"
echo "Verified $PBF and linked it into Valhalla data."
