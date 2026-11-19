#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "BLOCKED: .env is required for the backup recipient configuration." >&2
  exit 1
fi
AGE_RECIPIENT="$(grep -m1 '^AGE_RECIPIENT=' .env | cut -d= -f2- || true)"
AGE_RECIPIENT="${AGE_RECIPIENT%\"}"; AGE_RECIPIENT="${AGE_RECIPIENT#\"}"
if [[ -z "$AGE_RECIPIENT" || "$AGE_RECIPIENT" != age1* ]]; then
  echo "BLOCKED: set a valid AGE_RECIPIENT in the protected .env file." >&2
  exit 1
fi
command -v age >/dev/null || { echo "BLOCKED: install age before creating encrypted backups." >&2; exit 1; }
mkdir -p backups roundcube-db
docker volume inspect izakhono-mail-etc >/dev/null 2>&1 || { echo "BLOCKED: Stalwart config volume is missing." >&2; exit 1; }
docker volume inspect izakhono-mail-data >/dev/null 2>&1 || { echo "BLOCKED: Stalwart data volume is missing." >&2; exit 1; }

existing_stalwart="$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^stalwartlabs\/stalwart/ {print $1}')"
if [[ -n "$existing_stalwart" && "$existing_stalwart" != "izakhono-mailserver" ]]; then
  echo "BLOCKED: non-canonical Stalwart container is running: $existing_stalwart" >&2
  exit 1
fi
was_mail="$(docker inspect -f '{{.State.Running}}' izakhono-mailserver 2>/dev/null || echo false)"
was_db="$(docker inspect -f '{{.State.Running}}' izakhono-roundcube-db 2>/dev/null || echo false)"
was_webmail="$(docker inspect -f '{{.State.Running}}' izakhono-roundcube 2>/dev/null || echo false)"
restart_previous() {
  if [[ "$was_mail" == true ]]; then docker start izakhono-mailserver >/dev/null 2>&1 || true; fi
  if [[ "$was_db" == true ]]; then docker start izakhono-roundcube-db >/dev/null 2>&1 || true; fi
  if [[ "$was_webmail" == true ]]; then docker start izakhono-roundcube >/dev/null 2>&1 || true; fi
}
stage="$(mktemp -d backups/.mail-backup.XXXXXX)"
cleanup() { restart_previous; rm -rf "$stage"; }
trap cleanup EXIT

echo "[1/4] Quiescing mail services for a consistent data snapshot..."
docker stop izakhono-roundcube izakhono-roundcube-db izakhono-mailserver >/dev/null 2>&1 || true

echo "[2/4] Snapshotting Stalwart and Roundcube data (runtime secrets are excluded)..."
docker run --rm --network none \
  -v izakhono-mail-etc:/source/stalwart-etc:ro \
  -v izakhono-mail-data:/source/stalwart-data:ro \
  -v "$(pwd)/roundcube-db:/source/roundcube-db:ro" \
  -v "$(pwd)/$stage:/out" \
  alpine:3.20 sh -c 'tar -czf /out/data.tar.gz -C /source stalwart-etc stalwart-data roundcube-db'

echo "[3/4] Encrypting backup with age..."
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="backups/izakhono-mail-$stamp.tar.gz.age"
age -r "$AGE_RECIPIENT" -o "$output" "$stage/data.tar.gz"
sha256sum "$output" > "$output.sha256"
chmod 600 "$output" "$output.sha256"

echo "[4/4] Writing non-secret backup evidence..."
digest="$(sha256sum "$output" | awk '{print $1}')"
cat > "$output.evidence.json" <<EOF
{
  "schema": "izakhono.mail-backup-evidence/v1",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "artifact": "$output",
  "sha256": "$digest",
  "encrypted": true,
  "components": ["stalwart-etc", "stalwart-data", "roundcube-db"],
  "secrets_included": false,
  "runtime_secrets_source": "owner-controlled-secret-store"
}
EOF
chmod 600 "$output.evidence.json"
echo "BACKUP CREATED: $output"
echo "SHA256: $digest"
echo "The .env file, Stalwart admin credentials and age identity are not included."
