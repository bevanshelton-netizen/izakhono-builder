#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cp "$ROOT/NODE01-ACTIVATE.sh" "$TMP/NODE01-ACTIVATE.sh"
DOCKER_LOG="$TMP/docker.log"
export DOCKER_LOG

for script in NODE-PREFLIGHT.sh bootstrap-owned.sh NODE-COMPLIANCE.sh; do
  cat > "$TMP/$script" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
STUB
  chmod +x "$TMP/$script"
done

cat > "$TMP/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "$DOCKER_LOG"
exit 0
STUB
cat > "$TMP/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'ok\n'
STUB
chmod +x "$TMP/bin/docker" "$TMP/bin/curl"

(
  cd "$TMP"
  PATH="$TMP/bin:$PATH" IZAKHONO_ACTIVATE_DEPLOY_CONTROL=1 bash ./NODE01-ACTIVATE.sh >/dev/null
)
grep -q -- '--profile deploy-control up -d deploy-control' "$DOCKER_LOG" || {
  echo "signed DEPLOY action did not start the optional profile" >&2
  exit 1
}

: > "$DOCKER_LOG"
(
  cd "$TMP"
  PATH="$TMP/bin:$PATH" IZAKHONO_ACTIVATE_DEPLOY_CONTROL=0 bash ./NODE01-ACTIVATE.sh >/dev/null
)
if grep -q -- '--profile deploy-control up -d deploy-control' "$DOCKER_LOG"; then
  echo "DEPLOY profile started without owner-authorised action" >&2
  exit 1
fi

echo "NODE01 optional DEPLOY profile gate tests passed."
