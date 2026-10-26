#!/usr/bin/env bash
set -euo pipefail

EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
NODE_ID="${IZAKHONO_NODE_ID:-node01}"
NOW="$(date +%s)"

[[ "$(id -u)" -eq 0 ]] || { echo "run-as-root-required" >&2; exit 2; }
command -v k3s >/dev/null || { echo "k3s-not-found" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker-not-found" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3-not-found" >&2; exit 2; }

mkdir -p "$EVIDENCE_ROOT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Physical cluster proof: the verifier itself must pass on the target node.
bash "$ROOT/infra/node-cluster/verify-cluster.sh" > "$TMP/cluster.txt"
grep -q '^IZAKHONO_NODE_CLUSTER=PASS$' "$TMP/cluster.txt"

# Security proof is intentionally concrete and local: required secrets are present,
# protected, and the CONNECTA stack does not publish PostgreSQL/admin ports.
ENV_FILE=/etc/izakhono/apps/connecta.env
[[ -f "$ENV_FILE" ]] || { echo "connecta-env-missing" >&2; exit 20; }
MODE="$(stat -c '%a' "$ENV_FILE")"
OWNER="$(stat -c '%u:%g' "$ENV_FILE")"
[[ "$MODE" == "600" || "$MODE" == "640" ]] || { echo "connecta-env-permissions-too-open:$MODE" >&2; exit 21; }

PORTS="$(docker ps --format '{{.Names}} {{.Ports}}')"
if grep -Eq '0\.0\.0\.0:(5432|4100)(-|,|$)|\[::\]:(5432|4100)(-|,|$)' <<<"$PORTS"; then
  echo "private-connecta-port-published:$PORTS" >&2
  exit 22
fi

python3 - "$EVIDENCE_ROOT" "$COMMIT" "$NODE_ID" "$NOW" "$MODE" "$OWNER" "$TMP/cluster.txt" <<'PY'
import json, os, pathlib, sys
root, commit, node_id, now, mode, owner, cluster_file = sys.argv[1:]
cluster = pathlib.Path(cluster_file).read_text(encoding='utf-8').splitlines()
base = pathlib.Path(root)
base.mkdir(parents=True, exist_ok=True)

def write(name, payload):
    target = base / name
    tmp = target.with_suffix(target.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write('\n')
    os.chmod(tmp, 0o600)
    os.replace(tmp, target)

write('cluster-physical.json', {
    'schema': 'izakhono.connecta.gate.cluster-physical.v1',
    'status': 'PASS',
    'evidence_source': 'write-connecta-cluster-security-evidence.sh:physical-node-execution',
    'checked_at_epoch': int(now),
    'node_id': node_id,
    'immutable_commit': commit,
    'cluster_verifier': 'infra/node-cluster/verify-cluster.sh',
    'verifier_output': cluster,
})
write('security.json', {
    'schema': 'izakhono.connecta.gate.security.v1',
    'status': 'PASS',
    'evidence_source': 'write-connecta-cluster-security-evidence.sh:physical-node-execution',
    'checked_at_epoch': int(now),
    'node_id': node_id,
    'immutable_commit': commit,
    'secret_env': {'path': '/etc/izakhono/apps/connecta.env', 'mode': mode, 'owner': owner},
    'private_ports': ['5432', '4100'],
    'private_port_publication_check': 'PASS',
})
PY

echo "CONNECTA_CLUSTER_SECURITY_EVIDENCE=PASS"
