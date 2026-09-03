#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

REPO_URL="${1:-}"
COMMIT="${2:-}"
EXPECTED_SLUG="${3:-}"

case "$REPO_URL" in
  https://github.com/bevanshelton-netizen/*.git) ;;
  *)
    echo '[FAIL] Reviewed public staging currently accepts only the owner-controlled bevanshelton-netizen GitHub namespace.' >&2
    exit 2
    ;;
esac
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo '[FAIL] A full immutable 40-character commit SHA is required.' >&2; exit 2; }
[[ "$EXPECTED_SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo '[FAIL] Safe expected slug is required.' >&2; exit 2; }

name="${REPO_URL##*/}"
name="${name%.git}"
repo_root=/srv/izakhono/repos
repo="$repo_root/$name"
mkdir -p "$repo_root"

if [ -d "$repo/.git" ]; then
  git -C "$repo" remote set-url origin "$REPO_URL"
else
  rm -rf "$repo"
  git init "$repo" >/dev/null
  git -C "$repo" remote add origin "$REPO_URL"
fi

echo "Fetching reviewed $EXPECTED_SLUG commit ${COMMIT:0:12}..."
git -C "$repo" fetch --depth 1 origin "$COMMIT"
git -C "$repo" checkout --detach --force FETCH_HEAD >/dev/null
resolved="$(git -C "$repo" rev-parse HEAD)"
[ "$resolved" = "$COMMIT" ] || { echo '[FAIL] Fetched commit did not match the reviewed pin.' >&2; exit 1; }

manifest="$repo/.izakhono.json"
[ -f "$manifest" ] || { echo '[FAIL] Reviewed repository has no .izakhono.json contract.' >&2; exit 1; }
actual_slug="$(jq -r '.slug // empty' "$manifest")"
[ "$actual_slug" = "$EXPECTED_SLUG" ] || {
  echo "[FAIL] Manifest slug '$actual_slug' does not match reviewed slug '$EXPECTED_SLUG'." >&2
  exit 1
}

/opt/izakhono/bin/stage-project.sh "$repo"
/opt/izakhono/bin/snapshot-sources.sh "$repo_root"

evidence_dir=/opt/izakhono/evidence
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
evidence="$evidence_dir/${EXPECTED_SLUG}-source-pin-${now//[:]/}.txt"
umask 077
cat > "$evidence" <<EOF
IZAKHONO_REVIEWED_SOURCE_PIN_VERSION=1
PROJECT_SLUG=$EXPECTED_SLUG
SOURCE_URL=$REPO_URL
SOURCE_COMMIT=$COMMIT
VERIFIED_COMMIT=$resolved
STAGED_UTC=$now
COMMERCIAL_PUBLICATION=false
EOF
sha256sum "$evidence" > "$evidence.sha256"
chmod 600 "$evidence" "$evidence.sha256"

echo "[PASS] $EXPECTED_SLUG is staged on the owner-controlled IZAKHONO host at reviewed commit ${COMMIT:0:12}."
echo 'No DNS, public HTTPS, payment or commercial cutover was changed.'
