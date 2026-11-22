#!/usr/bin/env bash
set -euo pipefail

# Fail-closed, provider-neutral CONNECTA production readiness state machine.
# Evidence must come from the selected runtime or an independent verifier.
# This script never changes DNS, EDGE/TLS, routing, or product metadata.

EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
REPORT="${CONNECTA_READINESS_REPORT:-$EVIDENCE_ROOT/connecta-production-readiness.json}"
MAX_AGE_SECONDS="${CONNECTA_READINESS_MAX_AGE_SECONDS:-86400}"
[[ "$MAX_AGE_SECONDS" =~ ^[0-9]+$ ]] || { echo "CONNECTA_READINESS_MAX_AGE_SECONDS must be a non-negative integer" >&2; exit 2; }
mkdir -p "$EVIDENCE_ROOT"
chmod 700 "$EVIDENCE_ROOT"

python3 - "$EVIDENCE_ROOT" "$REPORT" "$MAX_AGE_SECONDS" <<'PY'
import json, os, pathlib, sys, time

root, report_path, max_age_raw = sys.argv[1:]
max_age = int(max_age_raw)
now = int(time.time())
required = (
    "runtime", "health", "persistence", "backup_restore",
    "failover", "security", "edge_tls", "external_https",
)
checks = {}
failures = []
release_sha = runtime_id = runtime_provider = None

for name in required:
    path = pathlib.Path(root) / f"{name}.ok"
    item = {"gate": name, "path": str(path), "status": "MISSING"}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        item.update({
            "status": data.get("status", "INVALID"),
            "evidence_source": data.get("evidence_source"),
            "checked_at_epoch": data.get("checked_at_epoch"),
        })
        if data.get("status") != "PASS":
            failures.append(f"not-pass:{name}")
        source = data.get("evidence_source")
        if not source or source in {"inferred", "topology", "ci-only", "repository-only", "simulated"}:
            failures.append(f"untrusted-evidence-source:{name}")
        checked = data.get("checked_at_epoch")
        if not isinstance(checked, int) or isinstance(checked, bool):
            failures.append(f"invalid-timestamp:{name}")
        elif checked > now + 300:
            failures.append(f"future-timestamp:{name}")
        elif now - checked > max_age:
            failures.append(f"stale-evidence:{name}")
        sha = data.get("release_sha")
        rid = data.get("runtime_id")
        provider = data.get("runtime_provider")
        if not isinstance(sha, str) or len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha):
            failures.append(f"invalid-release-sha:{name}")
        if not isinstance(rid, str) or not rid.strip() or "PHYSICAL" in rid.lower():
            failures.append(f"invalid-logical-runtime-id:{name}")
        if not isinstance(provider, str) or not provider.strip():
            failures.append(f"missing-runtime-provider:{name}")
        if data.get("physical_hardware_required") is not False:
            failures.append(f"physical-hardware-dependency:{name}")
        if release_sha is None and isinstance(sha, str): release_sha = sha
        elif isinstance(sha, str) and sha != release_sha: failures.append(f"release-sha-mismatch:{name}")
        if runtime_id is None and isinstance(rid, str): runtime_id = rid
        elif isinstance(rid, str) and rid != runtime_id: failures.append(f"runtime-id-mismatch:{name}")
        if runtime_provider is None and isinstance(provider, str): runtime_provider = provider
        elif isinstance(provider, str) and provider != runtime_provider: failures.append(f"runtime-provider-mismatch:{name}")
    except FileNotFoundError:
        failures.append(f"missing:{name}")
    except Exception as exc:
        item["status"] = "INVALID"
        item["error"] = str(exc)
        failures.append(f"invalid-evidence:{name}")
    checks[name] = item

status = "PRODUCTION_READY" if not failures else "NOT_READY"
record = {
    "schema": "izakhono.connecta.production-readiness.v2",
    "checked_at_epoch": now,
    "status": status,
    "promotion_allowed": status == "PRODUCTION_READY",
    "release_sha": release_sha,
    "runtime_id": runtime_id,
    "runtime_provider": runtime_provider,
    "physical_hardware_required": False,
    "failures": failures,
    "gates": checks,
    "evidence_source": "fail-closed-provider-neutral-gate",
    "public_cutover_action": "NONE",
    "evidence_max_age_seconds": max_age,
    "note": "A passing report only validates fresh, consistent evidence. It does not perform or claim public promotion."
}
target = pathlib.Path(report_path)
target.parent.mkdir(parents=True, exist_ok=True)
tmp = target.with_suffix(target.suffix + ".tmp")
tmp.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
os.chmod(tmp, 0o600)
os.replace(tmp, target)
print(json.dumps(record, indent=2, sort_keys=True))
if status != "PRODUCTION_READY":
    print("CONNECTA_PRODUCTION_READINESS=NOT_READY")
    raise SystemExit(4)
print("CONNECTA_PRODUCTION_READINESS=PRODUCTION_READY")
PY
