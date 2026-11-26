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
MD5_TMP="$PBF.md5.remote.part"
LINK_TMP="$DATA_DIR/router/.south-africa-latest.osm.pbf.$$.tmp"
cleanup() { rm -f "$TMP" "$MD5_TMP" "$LINK_TMP"; }
trap cleanup EXIT INT TERM

echo "Downloading South Africa OSM extract to a staging file..."
rm -f "$TMP" "$MD5_TMP"
curl --fail --location --silent --show-error --retry 5 --retry-delay 3 --output "$TMP" "$PBF_URL"
curl --fail --location --silent --show-error --retry 5 --retry-delay 3 --output "$MD5_TMP" "$MD5_URL"
expected="$(awk 'NR == 1 {print $1}' "$MD5_TMP")"
actual="$(md5sum "$TMP" | awk '{print $1}')"
if [[ ! "$expected" =~ ^[[:xdigit:]]{32}$ || "${actual,,}" != "${expected,,}" ]]; then
  echo "OSM checksum mismatch: expected=$expected actual=$actual" >&2
  exit 2
fi
# Publish only after the downloaded artifact has passed source checksum validation.
mv -f "$TMP" "$PBF"
mv -f "$MD5_TMP" "$PBF.md5.remote"
printf '%s  %s\\n' "$actual" "$(basename "$PBF")" > "$PBF.md5"
ln -s "$PBF" "$LINK_TMP"
mv -Tf "$LINK_TMP" "$DATA_DIR/router/south-africa-latest.osm.pbf"
echo "Verified and atomically published $PBF."
