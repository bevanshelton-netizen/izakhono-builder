#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export IZAKHONO_PROVISIONER_STATE="$TMP/state"
mkdir -p "$TMP/state/provisioning"
cp "$ROOT/runtime-evidence.example.json" "$TMP/evidence.json"
cat > "$TMP/provision.json" <<'JSON'
{"schema":"izakhono.provision/v1","slug":"faisready","target":"NODE01","deployment_authority":"owned-runtime","live":false}
JSON
bash -n "$ROOT/deployment-evidence.sh"
"$ROOT/deployment-evidence.sh" verify "$TMP/provision.json" "$TMP/evidence.json" >/dev/null
jq -e '.schema == "izakhono.runtime-evidence/v1" and .slug == "faisready" and .target == "NODE01" and .live == false' "$TMP/state/evidence/faisready.json" >/dev/null
jq -e 'has("promotion") | not' "$TMP/state/evidence/faisready.json" >/dev/null
if jq 'del(.https_verified)' "$TMP/evidence.json" > "$TMP/bad.json" && "$ROOT/deployment-evidence.sh" verify "$TMP/provision.json" "$TMP/bad.json" >/dev/null 2>&1; then
  echo "[FAIL] incomplete evidence was accepted" >&2
  exit 1
fi
echo '[PASS] Owned-runtime deployment evidence contract verified without LIVE promotion.'
