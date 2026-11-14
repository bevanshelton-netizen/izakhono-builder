#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
SNAPSHOT_ID="${1:-}"
[[ -n "$SNAPSHOT_ID" ]] || { echo "Usage: ./RESTORE-CONFIG-OWNED.sh <restic-snapshot-id>" >&2; exit 1; }
[[ -f .backup.env ]] || { echo ".backup.env is required and must be stored separately from the Restic repository." >&2; exit 2; }

set -a
. ./.backup.env
set +a
: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"
command -v restic >/dev/null

TMP_ROOT="$(mktemp -d /var/tmp/izakhono-config-restore.XXXXXX)"
STAGE_DIR="$TMP_ROOT/stage"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="$ROOT/backups/recovered-config-$STAMP"
mkdir -p "$STAGE_DIR" "$ARTIFACT_DIR"
chmod 700 "$TMP_ROOT" "$STAGE_DIR" "$ARTIFACT_DIR"
trap 'rm -rf "$TMP_ROOT"' EXIT

restic restore "$SNAPSHOT_ID" --target "$TMP_ROOT"
ARCHIVE="$(find "$TMP_ROOT" -type f -name 'izakhono-host-*.tar.gz' | head -n1)"
[[ -n "$ARCHIVE" ]] || { echo "Host archive not found in selected snapshot." >&2; exit 3; }
[[ -f "$ARCHIVE.sha256" ]] || { echo "Host archive checksum is missing." >&2; exit 4; }
EXPECTED="$(awk '{print $1}' "$ARCHIVE.sha256")"
ACTUAL="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo "Host archive checksum mismatch." >&2; exit 5; }

tar -xzf "$ARCHIVE" -C "$STAGE_DIR"
[[ -s "$STAGE_DIR/host.env" ]] || { echo "Recovered archive does not contain host.env." >&2; exit 6; }
for required in host-secrets/host_admin_password mail-secrets/mail_admin_password mail-secrets/roundcube_db_password mail-secrets/roundcube_des_key; do
  [[ -s "$STAGE_DIR/$required" ]] || { echo "Required recovery secret missing: $required" >&2; exit 7; }
done

if [[ ! -f .env ]]; then
  cp "$STAGE_DIR/host.env" .env
  chmod 600 .env
  echo "Recovered missing .env from encrypted snapshot."
else
  echo "Existing .env preserved; recovered host.env is available in the artifact folder for comparison."
fi

for pair in "host-secrets:host/secrets" "mail-secrets:mail/secrets"; do
  source_dir="${pair%%:*}"
  target_dir="${pair#*:}"
  mkdir -p "$target_dir"
  for item in "$STAGE_DIR/$source_dir"/*; do
    [[ -e "$item" ]] || continue
    target="$target_dir/$(basename "$item")"
    [[ -e "$target" ]] || cp -a "$item" "$target"
  done
  chmod -R go-rwx "$target_dir"
done

cp -a "$STAGE_DIR/." "$ARTIFACT_DIR/"
chmod -R go-rwx "$ARTIFACT_DIR"
echo "Configuration and missing owner secrets recovered."
echo "Recovery artifacts: $ARTIFACT_DIR"
echo "Next: review .env, then run ./restore-owned.sh $SNAPSHOT_ID for the full runtime/database restore."
