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
  local expected_host="$1" expiry="$2" deploy_action="${3:-no}"
  python3 - "$APPROVAL" "$expected_host" "$REVISION" "$expiry" "$deploy_action" <<'PY'
import datetime as dt
import json
import sys

path, host, revision, expiry_kind, deploy_action = sys.argv[1:6]
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
    "runner_health": "online",
    "approved_by": "ci-test-owner",
    "change_reference": "CI-CHANGE-1",
    "rollback_reference": "CI-ROLLBACK-1",
    "backup_restore_reference": "CI-BACKUP-1",
    "approved_at": now.isoformat().replace("+00:00", "Z"),
    "expires_at": expires.isoformat().replace("+00:00", "Z"),
    "allowed_actions": ["activate-owned-runtime"] + (["activate-deploy-control-api"] if deploy_action == "yes" else []),
    "runtime_database_fingerprint": "a" * 64,
    "runtime_database_id": "runtime-fabric-production",
    "runtime_database_environment": "production",
    "runtime_database_owner": "IZAKHONO Africa (Pty) Ltd",
    "runtime_migration_runner": "NODE01-approved-runner",
    "fortress_introspection_endpoint": "https://fortress.test.invalid/api/fortress/deploy-token/introspect",
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

write_approval "$HOST" "valid" "yes"
sign_approval
VERIFY_OUTPUT="$(verify_approval)"
grep -q "Optional DEPLOY API activation: owner-authorised." <<<"$VERIFY_OUTPUT"

write_approval "$HOST" "valid" "no"
sign_approval
VERIFY_OUTPUT="$(verify_approval)"
grep -q "Optional DEPLOY API activation: not authorised." <<<"$VERIFY_OUTPUT"

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
