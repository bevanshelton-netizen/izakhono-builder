#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_DIR="${ROOT}/manifests"

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[PASS] $*"; }

command -v jq >/dev/null 2>&1 || fail "jq is required"
[ -d "$MANIFEST_DIR" ] || fail "manifest directory missing: $MANIFEST_DIR"

count=0
for manifest in "$MANIFEST_DIR"/*.json; do
  [ -f "$manifest" ] || continue
  count=$((count + 1))

  jq -e '
    .schema == "izakhono.app/v1" and
    (.slug | type == "string" and test("^[a-z0-9][a-z0-9-]*$")) and
    (.name | type == "string" and length > 0) and
    (.source.path | type == "string" and length > 0) and
    (.source.branch | type == "string" and length > 0) and
    (.runtime.container_port | type == "number" and . >= 1 and . <= 65535) and
    (.runtime.health_path | type == "string" and startswith("/")) and
    (.runtime.network == "izakhono_private") and
    (.runtime.user == "node") and
    (.production.owner == "IZAKHONO AFRICA (PTY) LTD") and
    (.production.policy == "owned-first-externally-reversible") and
    (.production.target | IN("NODE01", "NODE02", "NODE03", "NODE04")) and
    (.production.live == false) and
    (.rollback.required == true) and
    (.rollback.artifact_identity == "immutable-image-digest")
  ' "$manifest" >/dev/null || fail "invalid application manifest: $(basename "$manifest")"

  slug="$(jq -r '.slug' "$manifest")"
  expected="${MANIFEST_DIR}/${slug}.json"
  [ "$manifest" = "$expected" ] || fail "manifest filename must match slug: $(basename "$manifest")"

  source_path="$(jq -r '.source.path' "$manifest")"
  [[ "$source_path" != /* && "$source_path" != *".."* ]] || fail "unsafe source path in $slug"

  pass "validated $slug"
done

[ "$count" -gt 0 ] || fail "no application manifests found"

slugs="$(for manifest in "$MANIFEST_DIR"/*.json; do jq -r '.slug' "$manifest"; done | sort)"
[ "$(printf '%s\n' "$slugs" | uniq -d | wc -l)" -eq 0 ] || fail "duplicate application slug detected"

pass "validated $count IZAKHONO application manifests"
pass "owned-first policy, software node targeting, health contract and immutable rollback are enforced"
