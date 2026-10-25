#!/usr/bin/env bash
set -Eeuo pipefail

# IZAKHONO Runtime Fabric — KORA production activation orchestrator.
# Node identities are software-defined. This orchestrator selects the first
# eligible runtime from NODE01 -> NODE02 -> NODE03 -> NODE04, then delegates
# workload activation to the KORA mail/runtime adapters. It never prints secrets
# and never promotes a workload to LIVE_VERIFIED by itself.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NODE_ID="${IZAKHONO_NODE_ID:-}"
NODE_ORDER=(node01 node02 node03 node04)
EVIDENCE_DIR="${KORA_PRODUCTION_EVIDENCE_DIR:-/opt/izakhono/kora/evidence}"
WORKLOAD_FILE="${KORA_WORKLOAD_FILE:-${ROOT}/runtime-fabric/workloads/kora-mail.json}"
MAIL_ACTIVATOR="${KORA_MAIL_ACTIVATOR:-${ROOT}/runtime-fabric/activation/KORA-MAIL-ACTIVATE.sh}"
LIVE_GATE="${KORA_MAIL_LIVE_GATE:-${ROOT}/runtime-fabric/acceptance/KORA-MAIL-LIVE-GATE.sh}"
NODE_HEALTH_CMD="${IZAKHONO_NODE_HEALTH_CMD:-}"

fail() { echo "KORA PRODUCTION ACTIVATION BLOCKED: $*" >&2; exit 1; }

[[ -f "${WORKLOAD_FILE}" ]] || fail "KORA workload contract not found"
[[ -x "${MAIL_ACTIVATOR}" ]] || fail "KORA mail activation adapter is not executable"
[[ -x "${LIVE_GATE}" ]] || fail "KORA live gate is not executable"

python3 - "${WORKLOAD_FILE}" <<'PY'
import json, sys
p = sys.argv[1]
data = json.load(open(p))
assert data["workload"] == "kora-mail"
assert data["runtime"]["mode"] == "node-agnostic"
assert data["runtime"]["preferred_nodes"] == ["node01", "node02", "node03", "node04"]
assert data["deployment"]["backup_before_promotion"] is True
assert data["deployment"]["rollback_required"] is True
assert data["deployment"]["health_required"] is True
assert data["acceptance"]["promotion"] == "LIVE_VERIFIED only after all acceptance gates pass"
print("KORA production workload contract: PASS")
PY

mkdir -p "${EVIDENCE_DIR}"
chmod 700 "${EVIDENCE_DIR}"

# Node selection is deliberately abstract. The runtime fabric can supply a
# health command that knows how to interrogate its software-defined nodes.
# Without that command we do not guess that a node is healthy.
select_node() {
  if [[ -n "${NODE_ID}" ]]; then
    case "${NODE_ID}" in
      node01|node02|node03|node04) echo "${NODE_ID}"; return 0 ;;
      *) fail "unsupported IZAKHONO_NODE_ID: ${NODE_ID}" ;;
    esac
  fi

  [[ -n "${NODE_HEALTH_CMD}" ]] || return 1
  local node
  for node in "${NODE_ORDER[@]}"; do
    if IZAKHONO_NODE_ID="${node}" ${NODE_HEALTH_CMD} >/dev/null 2>&1; then
      echo "${node}"
      return 0
    fi
  done
  return 1
}

SELECTED_NODE="$(select_node)" || fail "no eligible software-defined IZAKHONO node passed health selection"

cat > "${EVIDENCE_DIR}/selection.json" <<EOF
{
  "workload": "kora-mail",
  "selected_node": "${SELECTED_NODE}",
  "selection_order": ["node01", "node02", "node03", "node04"],
  "node_model": "software-defined",
  "activation_started": true,
  "promotion": "BLOCKED_UNTIL_EXTERNAL_SEND_RECEIVE_REPLY"
}
EOF
chmod 600 "${EVIDENCE_DIR}/selection.json"

# Delegate actual runtime work. Secrets remain in the protected runtime
# environment and are not copied into evidence or logs.
export IZAKHONO_NODE_ID="${SELECTED_NODE}"
"${MAIL_ACTIVATOR}"

# The live gate is intentionally expected to block until real external
# send/receive/reply/authentication evidence exists. A blocked gate is not a
# failed activation; it is the correct safety boundary.
set +e
"${LIVE_GATE}"
GATE_STATUS=$?
set -e

if [[ "${GATE_STATUS}" -eq 0 ]]; then
  STATUS="LIVE_VERIFIED"
else
  STATUS="ACTIVATED_AWAITING_EXTERNAL_ACCEPTANCE"
fi

cat > "${EVIDENCE_DIR}/production-activation.json" <<EOF
{
  "workload": "kora-mail",
  "node": "${SELECTED_NODE}",
  "status": "${STATUS}",
  "node_model": "software-defined",
  "failover_order": ["node02", "node03", "node04", "external-resilience"],
  "external_acceptance_required": true
}
EOF
chmod 600 "${EVIDENCE_DIR}/production-activation.json"

if [[ "${GATE_STATUS}" -eq 0 ]]; then
  echo "KORA PRODUCTION ACTIVATION: LIVE_VERIFIED"
else
  echo "KORA PRODUCTION ACTIVATION: RUNTIME ACTIVATED; LIVE_VERIFIED PENDING EXTERNAL ACCEPTANCE"
fi
