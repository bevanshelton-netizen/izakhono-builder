#!/usr/bin/env bash
set -euo pipefail

# Exercises the health-gate protocol with a local fake curl. No external runtime
# is contacted; these fixtures are CI tests, never production evidence.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
url="${!#}"
case "$url" in
  https://node01.example.test/health) printf '%s\n' '{"ok":true,"runtimeNode":"NODE01","cluster":"izakhono-production"}' ;;
  https://node02.example.test/health) printf '%s\n' '{"ok":true,"runtimeNode":"NODE02","cluster":"izakhono-production"}' ;;
  https://node03.example.test/health) printf '%s\n' '{"ok":true,"runtimeNode":"NODE03","cluster":"izakhono-production"}' ;;
  https://node04.example.test/health) printf '%s\n' '{"ok":true,"runtimeNode":"NODE04","cluster":"izakhono-production"}' ;;
  *) exit 22 ;;
esac
CURL
chmod +x "$tmp/bin/curl"

# A distinct endpoint for each node plus matching runtime identity passes the
# health producer and downstream evidence verifier.
PATH="$tmp/bin:$PATH" \
NODE01_URL=https://node01.example.test/health \
NODE02_URL=https://node02.example.test/health \
NODE03_URL=https://node03.example.test/health \
NODE04_URL=https://node04.example.test/health \
OUTPUT="$tmp/valid.json" \
bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"
bash "$ROOT/infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh" "$tmp/valid.json"

# Reusing one URL for four node names must fail before any curl request.
set +e
PATH="$tmp/bin:$PATH" \
NODE01_URL=https://node01.example.test/health \
NODE02_URL=https://node01.example.test/health \
NODE03_URL=https://node01.example.test/health \
NODE04_URL=https://node01.example.test/health \
OUTPUT="$tmp/duplicate.json" \
bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh" >/dev/null 2>&1
code=$?
set -e
[[ "$code" -eq 1 ]] || { echo "[FAIL] duplicate endpoint set expected exit 1, got $code" >&2; exit 1; }
python3 - "$tmp/duplicate.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1], encoding="utf-8"))
assert d["status"] == "BLOCKED"
assert all(n["status"] == "DUPLICATE_ENDPOINT" for n in d["nodes"])
PY
echo "[PASS] health gate verifies unique per-node runtime endpoints and rejects endpoint reuse."
