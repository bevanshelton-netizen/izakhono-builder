#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$HERE/.env"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE; copy .env.example and configure it first." >&2; exit 2; }
set -a
source "$ENV_FILE"
set +a
RAW_DATA_DIR="${NAV_DATA_DIR:-runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then DATA_DIR="$RAW_DATA_DIR"; else DATA_DIR="$HERE/$RAW_DATA_DIR"; fi
PBF="$DATA_DIR/osm/south-africa-latest.osm.pbf"
NEW="$PBF.new"
MD5_NEW="$NEW.md5"
STAGING="$DATA_DIR/tiles/.refresh-$$"
PBF_LINK_TMP="$DATA_DIR/router/.south-africa-latest.osm.pbf.$$.tmp"
PBF_URL="https://download.geofabrik.de/africa/south-africa-latest.osm.pbf"
cleanup() { rm -f "$NEW" "$MD5_NEW" "$PBF_LINK_TMP"; rm -rf "$STAGING"; }
trap cleanup EXIT INT TERM
mkdir -p "$DATA_DIR/osm" "$DATA_DIR/router" "$DATA_DIR/tiles" "$DATA_DIR/tilemaker-store"
rm -f "$NEW" "$MD5_NEW"
curl --fail --location --silent --show-error --retry 5 --retry-delay 3 --output "$NEW" "$PBF_URL"
curl --fail --location --silent --show-error --retry 5 --retry-delay 3 --output "$MD5_NEW" "${PBF_URL}.md5"
expected="$(awk 'NR == 1 {print $1}' "$MD5_NEW")"
actual="$(md5sum "$NEW" | awk '{print $1}')"
[[ "$expected" =~ ^[[:xdigit:]]{32}$ && "${actual,,}" == "${expected,,}" ]] || { echo "New OSM extract checksum failed." >&2; exit 2; }
old=""
[[ -f "$PBF" ]] && old="$(md5sum "$PBF" | awk '{print $1}')"
if [[ "$old" == "$actual" ]]; then
  echo "South Africa OSM extract is already current."
  exit 0
fi

# Build replacement tiles against the verified candidate before changing the
# active PBF, router symlink or currently served PMTiles archive.
mkdir -p "$STAGING/store"
docker run --rm -v "$DATA_DIR:/data" ghcr.io/systemed/tilemaker:master \
  /data/osm/south-africa-latest.osm.pbf.new \
  --output "/data/tiles/$(basename "$STAGING")/south-africa.pmtiles.part" \
  --store "/data/tiles/$(basename "$STAGING")/store"
TILE_CANDIDATE="$STAGING/south-africa.pmtiles.part"
test -s "$TILE_CANDIDATE" || { echo "Tilemaker did not produce a non-empty PMTiles archive." >&2; exit 3; }
sha256sum "$TILE_CANDIDATE" > "$STAGING/south-africa.pmtiles.sha256"

# Preserve last-known-good source and tile artifacts before atomic promotion.
[[ -f "$PBF" ]] && cp -p "$PBF" "$PBF.previous"
[[ -f "$DATA_DIR/tiles/south-africa.pmtiles" ]] && cp -p "$DATA_DIR/tiles/south-africa.pmtiles" "$DATA_DIR/tiles/south-africa.pmtiles.previous"
mv -f "$NEW" "$PBF"
mv -f "$MD5_NEW" "$PBF.md5.remote"
printf '%s  %s\n' "$actual" "$(basename "$PBF")" > "$PBF.md5"
mv -f "$TILE_CANDIDATE" "$DATA_DIR/tiles/south-africa.pmtiles"
mv -f "$STAGING/south-africa.pmtiles.sha256" "$DATA_DIR/tiles/south-africa.pmtiles.sha256"
ln -s "$PBF" "$PBF_LINK_TMP"
mv -Tf "$PBF_LINK_TMP" "$DATA_DIR/router/south-africa-latest.osm.pbf"

echo "Verified OSM and PMTiles artifacts promoted. Restarting owned NAV services..."
docker compose --env-file "$ENV_FILE" -f "$HERE/compose.yaml" restart nav-router nav-tiles
echo "Nominatim remains on continuous Geofabrik replication; no destructive reimport was performed."
