#!/usr/bin/env bash
set -euo pipefail
NAME="${1:?repository name required}"
[[ "$NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo invalid-name >&2; exit 2; }
ROOT=/srv/izakhono-code/repos
install -d -o izakhono-code -g izakhono-code -m 0750 "$ROOT"
REPO="$ROOT/$NAME.git"
[[ ! -e "$REPO" ]] || { echo exists >&2; exit 3; }
sudo -u izakhono-code git init --bare "$REPO" >/dev/null
git --git-dir="$REPO" config receive.denyNonFastForwards true
git --git-dir="$REPO" config core.sharedRepository group
chown -R izakhono-code:izakhono-code "$REPO"
printf 'IZAKHONO_CODE_REPO=%s\n' "$REPO"
printf 'SSH_URL=izakhono-code@<node>:%s.git\n' "$NAME"
