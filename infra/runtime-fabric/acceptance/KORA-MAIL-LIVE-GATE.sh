#!/usr/bin/env bash
set -Eeuo pipefail

# KORA mail promotion gate. This gate is intentionally evidence-driven.
# It does not manufacture delivery evidence and never promotes from static
# DNS/TLS checks alone.
#
# Exit codes are part of the orchestrator contract:
#   0 = LIVE_VERIFIED
#   2 = external acceptance evidence is not yet present
#   1 = evidence/configuration is invalid or an internal gate failed

EVIDENCE_DIR="${KORA_MAIL_EVIDENCE_DIR:-/opt/izakhono/kora-mail/evidence}"
MAILBOX="info@streamkoraafrica.com"

fail(){ echo "KORA MAIL LIVE GATE: BLOCKED — $*" >&2; exit 1; }
pending(){ echo "KORA MAIL LIVE GATE: PENDING — $*" >&2; exit 2; }

[[ -d "${EVIDENCE_DIR}" ]] || fail "evidence directory missing"
[[ -f "${EVIDENCE_DIR}/activation.json" ]] || fail "activation evidence missing"
[[ -f "${EVIDENCE_DIR}/static-acceptance.json" ]] || fail "static acceptance evidence missing"

python3 - "${EVIDENCE_DIR}" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
activation = json.loads((root / 'activation.json').read_text())
static = json.loads((root / 'static-acceptance.json').read_text())
assert activation.get('workload') == 'kora-mail'
assert activation.get('activated') is True
assert static.get('passed') is True
PY

# These files must be created only by a real external acceptance runner.
for f in inbound.json outbound.json reply.json authentication.json; do
  [[ -f "${EVIDENCE_DIR}/${f}" ]] || pending "missing real external evidence: ${f}"
done

python3 - "${EVIDENCE_DIR}" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
checks = {
    'inbound.json': 'received',
    'outbound.json': 'accepted',
    'reply.json': 'received',
    'authentication.json': 'passed',
}
for filename, key in checks.items():
    data = json.loads((root / filename).read_text())
    assert data.get(key) is True, f'{filename}: {key} is not true'

auth = json.loads((root / 'authentication.json').read_text())
for key in ('spf', 'dkim', 'dmarc'):
    assert auth.get(key) is True, f'authentication: {key} is not true'
print('KORA external mail acceptance: PASS')
PY

cat > "${EVIDENCE_DIR}/promotion.json" <<EOF
{
  "workload": "kora-mail",
  "identity": "${MAILBOX}",
  "status": "LIVE_VERIFIED",
  "gates": {
    "inbound": true,
    "outbound": true,
    "reply": true,
    "spf": true,
    "dkim": true,
    "dmarc": true
  }
}
EOF
chmod 600 "${EVIDENCE_DIR}/promotion.json"
echo "KORA MAIL LIVE GATE: LIVE_VERIFIED"
