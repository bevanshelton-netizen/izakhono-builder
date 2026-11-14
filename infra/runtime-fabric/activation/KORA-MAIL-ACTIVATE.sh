#!/usr/bin/env bash
set -Eeuo pipefail

# IZAKHONO Runtime Fabric activation adapter for KORA owned mail.
# This script is deliberately node-agnostic: the fabric supplies IZAKHONO_NODE_ID
# and a release bundle on whichever software-defined node is selected.
# It never stores or prints runtime secrets.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RELEASE_DIR="${KORA_MAIL_RELEASE_DIR:-${ROOT}/mail-stack/kora}"
NODE_ID="${IZAKHONO_NODE_ID:-}"
EVIDENCE_DIR="${KORA_MAIL_EVIDENCE_DIR:-/opt/izakhono/kora-mail/evidence}"

fail() { echo "KORA MAIL ACTIVATION BLOCKED: $*" >&2; exit 1; }

[[ -n "${NODE_ID}" ]] || fail "IZAKHONO_NODE_ID is required"
case "${NODE_ID}" in
  node01|node02|node03|node04) ;;
  *) fail "unsupported node identity: ${NODE_ID}" ;;
esac

[[ -d "${RELEASE_DIR}" ]] || fail "release directory not found: ${RELEASE_DIR}"
[[ -f "${RELEASE_DIR}/PROVISION-KORA-MAIL.sh" ]] || fail "KORA mail provisioner missing"
[[ -f "${RELEASE_DIR}/VERIFY-KORA-MAIL.sh" ]] || fail "KORA mail verifier missing"
[[ -f "${RELEASE_DIR}/../../runtime-fabric/workloads/kora-mail.json" ]] || fail "workload contract unavailable"

: "${KORA_MAIL_PASSWORD:?KORA_MAIL_PASSWORD must come from the FORTRESS-protected runtime secret store}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must come from the FORTRESS-protected runtime secret store}"

python3 - "${RELEASE_DIR}/../../runtime-fabric/workloads/kora-mail.json" <<'PY'
import json, sys
p = sys.argv[1]
data = json.load(open(p))
assert data["workload"] == "kora-mail"
assert data["runtime"]["mode"] == "node-agnostic"
assert data["runtime"]["preferred_nodes"] == ["node01", "node02", "node03", "node04"]
assert data["runtime"]["failover_order"] == ["node02", "node03", "node04", "external-resilience"]
assert data["acceptance"]["promotion"] == "LIVE_VERIFIED only after all acceptance gates pass"
print("KORA workload contract: PASS")
PY

mkdir -p "${EVIDENCE_DIR}"
chmod 700 "${EVIDENCE_DIR}"

# Idempotent activation: the provisioner owns DNS/TLS/mailbox setup and may be
# safely re-run. The selected node identity is recorded only after the command
# completes successfully.
chmod 700 "${RELEASE_DIR}/PROVISION-KORA-MAIL.sh" "${RELEASE_DIR}/VERIFY-KORA-MAIL.sh"
KORA_MAIL_PASSWORD="${KORA_MAIL_PASSWORD}" \
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" \
  "${RELEASE_DIR}/PROVISION-KORA-MAIL.sh"

# Static acceptance is evidence, not a promotion decision.
"${RELEASE_DIR}/VERIFY-KORA-MAIL.sh"

cat > "${EVIDENCE_DIR}/activation.json" <<EOF
{
  "workload": "kora-mail",
  "node": "${NODE_ID}",
  "activated": true,
  "static_acceptance": true,
  "promotion": "BLOCKED_UNTIL_EXTERNAL_SEND_RECEIVE_REPLY",
  "required_external_evidence": ["send", "receive", "reply", "spf", "dkim", "dmarc"]
}
EOF
chmod 600 "${EVIDENCE_DIR}/activation.json"

echo "KORA MAIL RUNTIME ACTIVATION: STATIC ACCEPTANCE PASSED"
echo "Selected software-defined node: ${NODE_ID}"
echo "Promotion remains blocked until external send -> receive -> reply and authentication evidence are verified."
