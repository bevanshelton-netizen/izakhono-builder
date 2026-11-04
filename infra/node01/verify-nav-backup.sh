#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: $0 /path/to/nav-backup" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
command -v sha256sum >/dev/null
command -v tar >/dev/null

[[ -s "$BACKUP_DIR/SHA256SUMS" ]] || { echo "ERROR: SHA256SUMS missing" >&2; exit 1; }
[[ -s "$BACKUP_DIR/backup-manifest.txt" ]] || { echo "ERROR: backup manifest missing" >&2; exit 1; }
[[ -s "$BACKUP_DIR/nav-compose.yml" && -s "$BACKUP_DIR/nav-Caddyfile" ]] || { echo "ERROR: deployment configuration missing" >&2; exit 1; }

(
  cd "$BACKUP_DIR"
  sha256sum -c SHA256SUMS
)

volume_count=0
while IFS= read -r line; do
  [[ "$line" == volume=* ]] || continue
  volume="${line#volume=}"
  volume="${volume%% *}"
  archive="$(sed -n "s/^volume=$volume archive=//p" "$BACKUP_DIR/backup-manifest.txt" | head -n 1)"
  [[ -n "$archive" && -s "$BACKUP_DIR/$archive" ]] || { echo "ERROR: archive missing for $volume" >&2; exit 1; }
  tar -tzf "$BACKUP_DIR/$archive" >/dev/null
  volume_count=$((volume_count + 1))
done < "$BACKUP_DIR/backup-manifest.txt"

(( volume_count > 0 )) || { echo "ERROR: no volume archives declared" >&2; exit 1; }
echo "NAV backup verification PASS: $volume_count volume archive(s)"
echo "Backup contents verified; this does not prove an application restore."
