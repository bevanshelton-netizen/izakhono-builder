#!/usr/bin/env bash
set -euo pipefail

# Run on NODE01 after the physical nodes have produced readiness evidence.
# This script never invents node state and never treats topology as evidence.

EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/var/lib/izakhono/evidence}"
REPORT="${IZAKHONO_CLUSTER_REPORT:-$EVIDENCE_ROOT/cluster-readiness.json}"
EXPECTED=(node01 node02 node03 node04)

mkdir -p "$EVIDENCE_ROOT"
chmod 700 "$EVIDENCE_ROOT"

status="NOT_READY"
failures=()
nodes=()

for node in "${EXPECTED[@]}"; do
  file="$EVIDENCE_ROOT/node-readiness-${node}.json"
  if [[ ! -f "$file" ]]; then
    failures+=("missing-evidence:$node")
    nodes+=("{\"node_id\":\"$node\",\"status\":\"MISSING_EVIDENCE\"}")
    continue
  fi

  node_status="$(python3 - "$file" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    d=json.load(f)
print(d.get('status','UNKNOWN'))
PY
)"

  if [[ "$node_status" != "PASS" ]]; then
    failures+=("node-not-ready:$node")
  fi
  nodes+=("$(python3 - "$file" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    d=json.load(f)
print(json.dumps({
    'node_id': d.get('node_id'),
    'hostname': d.get('hostname'),
    'status': d.get('status'),
    'checked_at_epoch': d.get('checked_at_epoch'),
    'evidence_source': d.get('evidence_source')
},separators=(',',':')))
PY
)")
done

if [[ "${#failures[@]}" -eq 0 ]]; then
  status="PHYSICALLY_VERIFIED"
fi

python3 - "$REPORT" "$status" "${failures[*]-}" "${nodes[*]}" <<'PY'
import json,sys,time
report,status,failures,nodes=sys.argv[1:]
parsed=[json.loads(x) for x in nodes.split('} ') if x]
record={
  'schema':'izakhono.cluster-readiness.v1',
  'checked_at_epoch':int(time.time()),
  'status':status,
  'required_nodes':['node01','node02','node03','node04'],
  'failures':failures.split() if failures else [],
  'nodes':parsed,
  'production_ready':False,
  'production_ready_reason':'Physical node evidence alone is insufficient; quorum, failover, backup/restore, encrypted networking/secrets, EDGE/TLS and independent HTTPS acceptance remain required.',
  'evidence_source':'physical-node-evidence-aggregation'
}
tmp=report+'.tmp'
with open(tmp,'w',encoding='utf-8') as f:
    json.dump(record,f,indent=2,sort_keys=True)
    f.write('\n')
import os
os.chmod(tmp,0o600)
os.replace(tmp,report)
print(json.dumps(record,indent=2,sort_keys=True))
PY

if [[ "$status" != "PHYSICALLY_VERIFIED" ]]; then
  exit 4
fi

echo "IZAKHONO_CLUSTER_PHYSICAL_READINESS=PASS"
echo "EVIDENCE=$REPORT"
