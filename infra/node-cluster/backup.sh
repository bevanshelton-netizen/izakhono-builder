#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${IZAKHONO_CLUSTER_ENV:-/etc/izakhono/node-cluster.env}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
source "$ENV_FILE"

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root." >&2; exit 2; }
command -v k3s >/dev/null || { echo "k3s is required on a server node." >&2; exit 2; }
command -v restic >/dev/null || { echo "restic is required." >&2; exit 2; }

if [[ -z "${RESTIC_REPOSITORY:-}" ]]; then
  echo "RESTIC_REPOSITORY is not configured." >&2
  exit 2
fi
if [[ ! -f "${RESTIC_PASSWORD_FILE:-}" ]]; then
  echo "RESTIC_PASSWORD_FILE is missing." >&2
  exit 2
fi

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="izakhono-$STAMP"

k3s etcd-snapshot save --name "$SNAPSHOT"

if ! restic snapshots >/dev/null 2>&1; then
  restic init
fi

restic backup   /var/lib/rancher/k3s/server/db/snapshots   "${IZAKHONO_DATA_ROOT:-/srv/izakhono}"   --tag izakhono-cluster   --tag "$(hostname)"

restic check --read-data-subset=5%
restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

echo "Encrypted cluster backup complete: $SNAPSHOT"
