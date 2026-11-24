#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APPROVAL_FILE="${IZAKHONO_ACTIVATION_APPROVAL_FILE:-/etc/izakhono/activation-approval.json}"
SIGNATURE_FILE="${IZAKHONO_ACTIVATION_APPROVAL_SIGNATURE:-${APPROVAL_FILE}.sig}"
PUBLIC_KEY="${IZAKHONO_OWNER_APPROVAL_PUBKEY:-/etc/izakhono/owner-approval.pub}"

fail() { printf 'NODE ENVIRONMENT ACTIVATION: BLOCKED — %s\n' "$1" >&2; exit 1; }
usage() {
  cat >&2 <<'EOF'
Usage:
  NODE-ENVIRONMENT-ACTIVATE.sh --preflight
  NODE-ENVIRONMENT-ACTIVATE.sh --verify-approval
  NODE-ENVIRONMENT-ACTIVATE.sh --activate

--preflight       Local read-only inventory only.
--verify-approval Verify the detached owner signature and signed host/revision binding.
--activate        Require root, valid owner approval, active registered runner,
                  read-only inventory and typed operator confirmation before activation.
EOF
  exit 2
}

[[ $# -eq 1 ]] || usage
MODE="$1"

if [[ "$MODE" == "--preflight" ]]; then
  [[ -f "$ROOT/NODE01-READONLY-PREFLIGHT.sh" ]] || fail "read-only preflight script is missing or not executable"
  exec bash "$ROOT/NODE01-READONLY-PREFLIGHT.sh"
fi

[[ "$MODE" == "--verify-approval" || "$MODE" == "--activate" ]] || usage
[[ -f "$ROOT/NODE01-ACTIVATE.sh" ]] || fail "NODE01-ACTIVATE.sh is missing or not executable"
command -v openssl >/dev/null 2>&1 || fail "OpenSSL is required"
command -v python3 >/dev/null 2>&1 || fail "Python 3 is required"
command -v git >/dev/null 2>&1 || fail "Git is required to pin the approved source revision"

[[ -f "$APPROVAL_FILE" && ! -L "$APPROVAL_FILE" ]] || fail "signed approval file is missing or is a symlink"
[[ -f "$SIGNATURE_FILE" && ! -L "$SIGNATURE_FILE" ]] || fail "detached approval signature is missing or is a symlink"
[[ -f "$PUBLIC_KEY" && ! -L "$PUBLIC_KEY" ]] || fail "trusted owner public key is missing or is a symlink"

REPO_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null)" ||
  fail "the repository root cannot be verified"

# Approval material must live outside the entire repository, not merely outside
# the products/izakhono-host subdirectory.
case "$APPROVAL_FILE:$SIGNATURE_FILE:$PUBLIC_KEY" in
  *"$REPO_ROOT"/*) fail "approval material and owner public key must be stored outside the repository" ;;
esac

EXPECTED_OWNER="$(id -u)"
if [[ "$MODE" == "--activate" ]]; then
  [[ "$(id -u)" == "0" ]] || fail "activation must run as root on the approved execution environment"
  EXPECTED_OWNER="0"
fi

check_owner_and_mode() {
  local file="$1" expected="$2" private="$3" owner mode numeric
  owner="$(stat -c '%u' "$file")" || fail "cannot inspect approval file ownership"
  mode="$(stat -c '%a' "$file")" || fail "cannot inspect approval file permissions"
  [[ "$owner" == "$expected" ]] || fail "approval material has an unexpected owner"
  numeric=$((8#$mode))
  if [[ "$private" == "yes" ]]; then
    (( (numeric & 077) == 0 )) || fail "approval JSON and signature must not be accessible by group or other users"
  else
    (( (numeric & 022) == 0 )) || fail "trusted public key must not be group/world writable"
  fi
}

check_owner_and_mode "$APPROVAL_FILE" "$EXPECTED_OWNER" yes
check_owner_and_mode "$SIGNATURE_FILE" "$EXPECTED_OWNER" yes
check_owner_and_mode "$PUBLIC_KEY" "$EXPECTED_OWNER" no

openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$SIGNATURE_FILE" "$APPROVAL_FILE" >/dev/null 2>&1 ||
  fail "owner signature verification failed"

CURRENT_HOST="$(hostname -f 2>/dev/null || hostname)"
CURRENT_REVISION="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)" ||
  fail "the current source revision cannot be verified"

APPROVAL_INFO="$(
python3 - "$APPROVAL_FILE" "$CURRENT_HOST" "$CURRENT_REVISION" <<'PY'
import datetime as dt
import json
import re
import sys

path, current_host, current_revision = sys.argv[1:4]
try:
    with open(path, "r", encoding="utf-8") as handle:
        approval = json.load(handle)
except Exception as exc:
    raise SystemExit("approval JSON is invalid")

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def nonempty(key):
    value = approval.get(key)
    require(isinstance(value, str) and value.strip(), f"approval field {key} is missing")
    return value.strip()

require(approval.get("version") == 1, "unsupported approval version")
require(approval.get("logical_node_id") == "NODE01", "logical software identity must be NODE01")
require(approval.get("identity_type") == "software-runtime", "identity type must be software-runtime")
require(approval.get("runtime_host_is_separate") is True, "runtime host must be declared separately")
require(approval.get("runner_registered") is True, "owner approval must attest runner registration")
require(approval.get("runner_health") == "online", "owner approval must attest that the runner is online")
require(nonempty("approval_id"), "approval ID is missing")
require(nonempty("environment"), "environment is missing")
locator = nonempty("environment_locator")
require(locator.lower() not in {"node01", "unknown", "placeholder", "replace-me", "tbd"}, "execution-environment locator is a placeholder")
require(nonempty("approved_by"), "approving operator is missing")
require(nonempty("change_reference"), "change reference is missing")
require(nonempty("rollback_reference"), "rollback reference is missing")
require(nonempty("backup_restore_reference"), "backup/restore evidence reference is missing")
require(approval.get("expected_hostname") == current_host, "approval is bound to a different host name")
require(approval.get("source_revision") == current_revision, "approved source revision does not match the checked-out code")
require(re.fullmatch(r"[0-9a-f]{40}", current_revision) is not None, "source revision must be a full Git commit SHA")

runner_id = nonempty("runner_id")
runner_service = nonempty("runner_service")
require(re.fullmatch(r"[A-Za-z0-9_.-]{3,128}", runner_id) is not None, "runner ID has invalid characters")
require(re.fullmatch(r"actions\.runner\.[A-Za-z0-9_.-]+\.service", runner_service) is not None, "runner service name is invalid")
labels = approval.get("runner_labels")
require(isinstance(labels, list) and all(isinstance(label, str) for label in labels), "runner labels must be an array of strings")
required_labels = {"self-hosted", "izakhono-owned-host", "node01-runtime"}
require(required_labels.issubset(set(labels)), "runner is missing required IZAKHONO host labels")

actions = approval.get("allowed_actions")
require(isinstance(actions, list) and all(isinstance(action, str) for action in actions)
        and "activate-owned-runtime" in actions, "approval does not authorize owned-runtime activation")

def parse_time(key):
    value = nonempty(key)
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SystemExit(f"approval field {key} must be an ISO-8601 timestamp")
    require(parsed.tzinfo is not None, f"approval field {key} must include a timezone")
    return parsed.astimezone(dt.timezone.utc)

now = dt.datetime.now(dt.timezone.utc)
approved_at = parse_time("approved_at")
expires_at = parse_time("expires_at")
require(approved_at <= now + dt.timedelta(minutes=5), "approval timestamp is in the future")
require(expires_at > now, "owner approval has expired")
require(expires_at > approved_at, "approval expiry must follow approval time")
require(expires_at <= approved_at + dt.timedelta(hours=24), "approval validity must not exceed 24 hours")

activate_deploy_control = "activate-deploy-control-api" in actions

print(runner_service)
print("1" if activate_deploy_control else "0")
PY
)" || fail "signed owner approval is invalid or does not match this host/revision"

RUNNER_SERVICE="$(printf '%s\n' "$APPROVAL_INFO" | head -n 1)"
DEPLOY_CONTROL_APPROVED="$(printf '%s\n' "$APPROVAL_INFO" | tail -n 1)"
[[ -n "$RUNNER_SERVICE" && ( "$DEPLOY_CONTROL_APPROVED" == "0" || "$DEPLOY_CONTROL_APPROVED" == "1" ) ]] ||
  fail "owner approval action data is invalid"

if [[ "$MODE" == "--verify-approval" ]]; then
  if [[ "$DEPLOY_CONTROL_APPROVED" == "1" ]]; then
    printf '%s\n' "Optional DEPLOY API activation: owner-authorised."
  else
    printf '%s\n' "Optional DEPLOY API activation: not authorised."
  fi
  printf '%s\n' "Owner signature, NODE01 identity, host binding and source revision verified. No activation performed."
  exit 0
fi

command -v systemctl >/dev/null 2>&1 || fail "systemd is required to verify the approved self-hosted runner"
systemctl is-active --quiet "$RUNNER_SERVICE" || fail "the owner-approved self-hosted runner service is not active"
[[ -f "$ROOT/NODE01-READONLY-PREFLIGHT.sh" ]] || fail "read-only preflight script is missing or not executable"

printf '%s\n' "Signed owner approval and runner service verified."
printf '%s\n' "Running local read-only inventory before activation."
bash "$ROOT/NODE01-READONLY-PREFLIGHT.sh"

[[ -t 0 ]] || fail "activation requires an interactive operator confirmation"
printf 'This will generate/check host secrets, build images and start the owned runtime.\n'
printf 'Type exactly: ACTIVATE NODE01 ON %s\n> ' "$CURRENT_HOST"
IFS= read -r confirmation
[[ "$confirmation" == "ACTIVATE NODE01 ON $CURRENT_HOST" ]] || fail "operator confirmation did not match"

printf '%s\n' "Executing the separately reviewed NODE01 activation sequence."
exec bash "$ROOT/NODE01-ACTIVATE.sh"
