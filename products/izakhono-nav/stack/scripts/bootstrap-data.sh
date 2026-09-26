#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$HERE/.env"
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a
DATA_DIR="${NAV_DATA_DIR:-$HERE/runtime-data}"
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
echo "Verified $PBF"
