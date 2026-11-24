#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
APPROVAL="$TMP/activation-approval.json"
SIGNATURE="$TMP/activation-approval.sig"
PUBLIC_KEY="$TMP/owner-approval.pub"
PRIVATE_KEY="$TMP/owner-approval.key"
HOST="$(hostname -f 2>/dev/null || hostname)"
REVISION="$(git -C "$ROOT" rev-parse HEAD)"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$PRIVATE_KEY" >/dev/null 2>&1
openssl pkey -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY" >/dev/null 2>&1
chmod 600 "$PRIVATE_KEY" "$PUBLIC_KEY"

write_approval() {
  local expected_host="$1" expiry="$2"
  python3 - "$APPROVAL" "$expected_host" "$REVISION" "$expiry" <<'PY'
import datetime as dt
import json
import sys

path, host, revision, expiry_kind = sys.argv[1:5]
now = dt.datetime.now(dt.timezone.utc)
expires = now - dt.timedelta(minutes=1) if expiry_kind == "expired" else now + dt.timedelta(hours=1)
approval = {
    "version": 1,
    "approval_id": "ci-activation-approval",
    "logical_node_id": "NODE01",
    "identity_type": "software-runtime",
    "runtime_host_is_separate": True,
    "environment": "ci-test",
    "environment_locator": "ci-host-instance-12345",
    "expected_hostname": host,
    "source_revision": revision,
    "runner_id": "runner-12345",
    "runner_service": "actions.runner.test-org.izakhono-node01.service",
    "runner_labels": ["self-hosted", "izakhono-owned-host", "node01-runtime"],
    "runner_registered": True,
    "approved_by": "ci-test-owner",
    "change_reference": "CI-CHANGE-1",
    "rollback_reference": "CI-ROLLBACK-1",
    "backup_restore_reference": "CI-BACKUP-1",
    "approved_at": now.isoformat().replace("+00:00", "Z"),
    "expires_at": expires.isoformat().replace("+00:00", "Z"),
    "allowed_actions": ["activate-owned-runtime"],
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(approval, handle, sort_keys=True)
PY
  chmod 600 "$APPROVAL"
}

sign_approval() {
  openssl dgst -sha256 -sign "$PRIVATE_KEY" -out "$SIGNATURE" "$APPROVAL" >/dev/null 2>&1
  chmod 600 "$SIGNATURE"
}

verify_approval() {
  IZAKHONO_ACTIVATION_APPROVAL_FILE="$APPROVAL" \
  IZAKHONO_ACTIVATION_APPROVAL_SIGNATURE="$SIGNATURE" \
  IZAKHONO_OWNER_APPROVAL_PUBKEY="$PUBLIC_KEY" \
    bash "$ROOT/NODE-ENVIRONMENT-ACTIVATE.sh" --verify-approval
}

write_approval "$HOST" "valid"
sign_approval
verify_approval

# A signed record must be invalidated by even a one-byte change.
printf ' ' >> "$APPROVAL"
if verify_approval >/dev/null 2>&1; then
  echo "tampered approval unexpectedly verified" >&2
  exit 1
fi

write_approval "$HOST" "expired"
sign_approval
if verify_approval >/dev/null 2>&1; then
  echo "expired approval unexpectedly verified" >&2
  exit 1
fi

write_approval "different-host.invalid" "valid"
sign_approval
if verify_approval >/dev/null 2>&1; then
  echo "approval for a different host unexpectedly verified" >&2
  exit 1
fi

echo "NODE environment activation approval tests passed; no activation was executed."
