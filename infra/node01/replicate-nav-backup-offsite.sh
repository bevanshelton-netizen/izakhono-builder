#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${1:-}"
REMOTE_DEST="${NODE01_BACKUP_REMOTE_DEST:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: NODE01_BACKUP_REMOTE_DEST=user@host:/absolute/path $0 /path/to/nav-backup" >&2; exit 2; }
[[ -n "$REMOTE_DEST" ]] || { echo "ERROR: NODE01_BACKUP_REMOTE_DEST is required" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

command -v rsync >/dev/null || { echo "ERROR: rsync is required" >&2; exit 1; }
command -v ssh >/dev/null || { echo "ERROR: ssh is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required" >&2; exit 1; }

# Restrict destination syntax so it is safe to embed in the remote shell command.
if [[ "$REMOTE_DEST" =~ ^([A-Za-z0-9._@-]+):(/([A-Za-z0-9._-]+/?)*)$ ]]; then
  REMOTE_HOST="${BASH_REMATCH[1]}"
  REMOTE_ROOT="${BASH_REMATCH[2]}"
else
  echo "ERROR: destination must be host:/absolute/path using a configured SSH host or user@host" >&2
  exit 2
fi
[[ "$REMOTE_ROOT" != *"/../"* && "$REMOTE_ROOT" != */.. ]] || { echo "ERROR: parent-directory traversal is not allowed" >&2; exit 2; }

bash infra/node01/verify-nav-backup.sh "$BACKUP_DIR"
BACKUP_ID="$(sed -n 's/^backup_id=//p' "$BACKUP_DIR/backup-manifest.txt" | head -n 1)"
[[ "$BACKUP_ID" =~ ^nav-node01-[0-9]{8}T[0-9]{6}Z$ ]] || { echo "ERROR: invalid backup_id in manifest" >&2; exit 1; }

REMOTE_PATH="${REMOTE_ROOT%/}/$BACKUP_ID"
echo "[NAV OFFSITE] preparing protected destination: $REMOTE_HOST:$REMOTE_PATH"
ssh -o BatchMode=yes "$REMOTE_HOST" "umask 077; mkdir -p -- '$REMOTE_PATH'; chmod 700 -- '$REMOTE_PATH'"

echo "[NAV OFFSITE] copying verified backup (no remote deletion)"
rsync -a --partial --protect-args --chmod=F600,D700 -e "ssh -o BatchMode=yes" "$BACKUP_DIR/" "$REMOTE_HOST:$REMOTE_PATH/"

echo "[NAV OFFSITE] verifying remote checksums"
ssh -o BatchMode=yes "$REMOTE_HOST" "cd '$REMOTE_PATH' && sha256sum -c SHA256SUMS"
echo "[NAV OFFSITE] PASS: remote copy checksum verification succeeded"
echo "[NAV OFFSITE] retention deletion is intentionally not automated"
