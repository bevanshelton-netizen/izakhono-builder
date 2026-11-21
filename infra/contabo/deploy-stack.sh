#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

: "${IZAKHONO_RELEASE_ID:?Set IZAKHONO_RELEASE_ID}"
: "${IZAKHONO_RELEASE_VERSION:?Set IZAKHONO_RELEASE_VERSION}"
: "${IZAKHONO_NODE_ID:?Set IZAKHONO_NODE_ID}"

case "$IZAKHONO_NODE_ID" in
  NODE01|NODE02|NODE03|NODE04) ;;
  *) echo "Invalid logical runtime identity: $IZAKHONO_NODE_ID" >&2; exit 2 ;;
esac
for value in "$IZAKHONO_RELEASE_ID" "$IZAKHONO_RELEASE_VERSION"; do
  [[ "$value" =~ ^[A-Za-z0-9._-]{1,80}$ ]] || {
    echo "Release ID/version may contain only letters, numbers, dot, underscore and hyphen." >&2
    exit 2
  }
done

CONFIG="/opt/izakhono/config/stack.env"
RELEASES="/opt/izakhono/releases"
CURRENT="/opt/izakhono/current"
PROJECT="izakhono-runtime"

# Validate the secret file before creating or switching a release. Never source it as shell code.
if [[ ! -f "$CONFIG" || -L "$CONFIG" ]]; then
  echo "Missing regular secret file $CONFIG; refusing to deploy." >&2
  exit 10
fi
chmod 600 "$CONFIG"

mkdir -p "$RELEASES"
RELEASE_DIR="$RELEASES/$IZAKHONO_RELEASE_ID"
if [[ -e "$RELEASE_DIR" ]]; then
  echo "Release already exists: $RELEASE_DIR (releases are immutable)." >&2
  exit 11
fi

STAGING="$(mktemp -d "$RELEASES/.staging.XXXXXX")"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

cp compose.yml "$STAGING/compose.yml"
cp -R postgres-init "$STAGING/postgres-init"

jq -n \
  --arg version "$IZAKHONO_RELEASE_VERSION" \
  --arg releaseId "$IZAKHONO_RELEASE_ID" \
  --arg schemaVersion "${IZAKHONO_SCHEMA_VERSION:-1}" \
  --arg nodeId "$IZAKHONO_NODE_ID" \
  '{
    product: "IZAKHONO Runtime Fabric",
    releaseVersion: $version,
    releaseId: $releaseId,
    schemaVersion: $schemaVersion,
    nodeId: $nodeId,
    routeClass: "external-resilience",
    immutable: true
  }' > "$STAGING/release.json"

# Render and validate the complete service graph before changing the current release.
CONFIG_JSON="$(docker compose --project-name "$PROJECT" --env-file "$CONFIG" -f "$STAGING/compose.yml" config --format json)"
if ! jq -e '
  [.services[] | .image] |
  length > 0 and all(.[]; . != null and test("@sha256:[0-9a-f]{64}$"))
' <<<"$CONFIG_JSON" >/dev/null; then
  echo "Every container image must be pinned to a verified sha256 digest in $CONFIG." >&2
  exit 12
fi

# Download required images before the live release pointer is changed.
docker compose --project-name "$PROJECT" --env-file "$CONFIG" -f "$STAGING/compose.yml" pull

mv "$STAGING" "$RELEASE_DIR"
trap - EXIT

PREVIOUS_TARGET="$(readlink "$CURRENT" 2>/dev/null || true)"
NEXT_LINK="/opt/izakhono/.current.$$"
ln -s "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT"

if ! docker compose --project-name "$PROJECT" --env-file "$CONFIG" -f "$CURRENT/compose.yml" up -d; then
  echo "New release failed to start; restoring the previous release pointer." >&2
  if [[ -n "$PREVIOUS_TARGET" ]]; then
    RESTORE_LINK="/opt/izakhono/.current.restore.$$"
    ln -s "$PREVIOUS_TARGET" "$RESTORE_LINK"
    mv -Tf "$RESTORE_LINK" "$CURRENT"
    if ! docker compose --project-name "$PROJECT" --env-file "$CONFIG" -f "$CURRENT/compose.yml" up -d; then
      echo "CRITICAL: previous release pointer restored, but its services did not recover automatically." >&2
    fi
  else
    rm -f "$CURRENT"
  fi
  exit 13
fi

docker compose --project-name "$PROJECT" --env-file "$CONFIG" -f "$CURRENT/compose.yml" ps
cat "$CURRENT/release.json"
printf '%s\n' "Release started on $IZAKHONO_NODE_ID; public LIVE status still requires EDGE/TLS/DNS and application verification."
