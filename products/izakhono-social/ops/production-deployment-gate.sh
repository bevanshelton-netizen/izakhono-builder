#!/usr/bin/env bash
set -euo pipefail

# CONNECTA provider-neutral production evidence gate.
# It validates evidence only; it never performs DNS, TLS, EDGE routing or cutover.
EVIDENCE_DIR="${CONNECTA_EVIDENCE_DIR:-/var/lib/izakhono/evidence/connecta}"
MAX_AGE="${CONNECTA_READINESS_MAX_AGE_SECONDS:-86400}"
REPORT="${CONNECTA_PROMOTION_REPORT:-$EVIDENCE_DIR/promotion-gate.json}"
[[ "$MAX_AGE" =~ ^[0-9]+$ ]] || { echo "CONNECTA_READINESS_MAX_AGE_SECONDS must be an integer" >&2; exit 2; }

python3 - "$EVIDENCE_DIR" "$MAX_AGE" "$REPORT" <<'PY'
import json,os,pathlib,sys,time
root,max_age_raw,report_path=sys.argv[1:]
max_age=int(max_age_raw); now=int(time.time())
required=('runtime','health','persistence','backup_restore','failover','security','edge_tls','external_https')
failures=[]; checks={}; expected={}
for name in required:
    path=pathlib.Path(root)/f'{name}.ok'
    item={'gate':name,'path':str(path),'status':'MISSING'}
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
        item.update(status=data.get('status'),evidence_source=data.get('evidence_source'),checked_at_epoch=data.get('checked_at_epoch'))
        if data.get('status')!='PASS': failures.append(f'{name}: status is not PASS')
        source=data.get('evidence_source')
        expected_sources={
            'runtime':'software-runtime-execution',
            'health':'software-runtime-execution',
            'persistence':'software-runtime-execution',
            'backup_restore':'software-runtime-execution',
            'failover':'prove-failover-evidence.sh:approved-runtime-operator',
            'security':'prove-security-evidence.sh:approved-runtime-execution',
            'edge_tls':'prove-edge-tls-evidence.sh:approved-runtime-edge-verification',
            'external_https':'prove-external-https-evidence.sh:independent-external-execution',
        }
        if not isinstance(source,str) or not source.startswith(expected_sources[name]): failures.append(f'{name}: untrusted evidence source')
        ts=data.get('checked_at_epoch')
        if not isinstance(ts,int) or isinstance(ts,bool): failures.append(f'{name}: invalid timestamp')
        elif ts>now+300: failures.append(f'{name}: future timestamp')
        elif now-ts>max_age: failures.append(f'{name}: stale evidence')
        for key in ('release_sha','runtime_id','runtime_provider'):
            value=data.get(key)
            if not isinstance(value,str) or not value.strip(): failures.append(f'{name}: missing {key}')
            elif key not in expected: expected[key]=value
            elif expected[key]!=value: failures.append(f'{name}: {key} mismatch')
        sha=data.get('release_sha')
        if not isinstance(sha,str) or len(sha)!=40 or any(c not in '0123456789abcdef' for c in sha): failures.append(f'{name}: invalid immutable release SHA')
        rid=data.get('runtime_id')
        if isinstance(rid,str) and ('NODE01' in rid.upper() or 'physical' in rid.lower()): failures.append(f'{name}: runtime identity must be logical')
        if data.get('physical_hardware_required') is not False: failures.append(f'{name}: physical_hardware_required must be false')
        if isinstance(data.get('runtime_id'),str) and 'physical' in data['runtime_id'].lower():
            failures.append(f'{name}: runtime_id must be a logical runtime identity')
    except FileNotFoundError:
        failures.append(f'{name}: missing evidence')
    except Exception as exc:
        item['status']='INVALID'; item['error']=str(exc); failures.append(f'{name}: invalid evidence: {exc}')
    checks[name]=item
status='PRODUCTION_GATES_PASS' if not failures else 'NOT_READY'
report={
 'schema':'izakhono.connecta.gate.production-promotion.v2',
 'status':status,
 'promotion_allowed':status=='PRODUCTION_GATES_PASS',
 'public_cutover_performed':False,
 'checked_at_epoch':now,
 'max_age_seconds':max_age,
 'release_sha':expected.get('release_sha'),
 'runtime_id':expected.get('runtime_id'),
 'runtime_provider':expected.get('runtime_provider'),
 'physical_hardware_required':False,
 'evidence_source':'fail-closed-provider-neutral-production-gate',
 'checks':checks,'failures':failures,
 'next_action':'Promotion still requires the separately authorised change procedure.' if status=='PRODUCTION_GATES_PASS' else 'Supply fresh, consistent PASS evidence for every runtime gate.'
}
target=pathlib.Path(report_path); target.parent.mkdir(parents=True,exist_ok=True)
tmp=target.with_suffix(target.suffix+'.tmp')
tmp.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n',encoding='utf-8')
os.chmod(tmp,0o600); os.replace(tmp,target)
print(json.dumps(report,indent=2,sort_keys=True))
if status!='PRODUCTION_GATES_PASS': raise SystemExit(2)
PY
