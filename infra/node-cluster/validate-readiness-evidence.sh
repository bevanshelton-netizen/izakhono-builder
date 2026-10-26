#!/usr/bin/env bash
set -euo pipefail

# Validate readiness evidence without asserting physical state.
# Intended for NODE01 or audit tooling after physical node checks have run.

EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/var/lib/izakhono/evidence}"
MAX_AGE_SECONDS="${IZAKHONO_READINESS_MAX_AGE_SECONDS:-86400}"
EXPECTED=(node01 node02 node03 node04)

python3 - "$EVIDENCE_ROOT" "$MAX_AGE_SECONDS" "${EXPECTED[@]}" <<'PY'
import json, sys, time
from pathlib import Path

root = Path(sys.argv[1])
try:
    max_age = int(sys.argv[2])
except ValueError:
    raise SystemExit("invalid IZAKHONO_READINESS_MAX_AGE_SECONDS")
expected = sys.argv[3:]
now = int(time.time())
failures = 0

for node in expected:
    path = root / f"node-readiness-{node}.json"
    if not path.is_file():
        print(f"FAIL missing:{path}")
        failures += 1
        continue
    try:
        with path.open(encoding="utf-8") as f:
            d = json.load(f)
    except Exception as exc:
        print(f"FAIL invalid-json:{path}: {exc}")
        failures += 1
        continue

    errors = []
    required = {
        "schema": "izakhono.node-readiness.v2",
        "node_id": node,
        "status": "PASS",
        "evidence_source": "physical-node-execution",
    }
    for key, value in required.items():
        if d.get(key) != value:
            errors.append(f"{key}={d.get(key)!r}, expected {value!r}")

    checked = d.get("checked_at_epoch")
    if not isinstance(checked, int) or checked <= 0:
        errors.append("checked_at_epoch invalid")
    elif checked > now + 300:
        errors.append("checked_at_epoch is in the future")
    elif now - checked > max_age:
        errors.append(f"evidence stale: age={now - checked}s max={max_age}s")

    if not isinstance(d.get("failures"), list) or d["failures"]:
        errors.append("failures must be an empty list")

    if errors:
        print(f"FAIL {path}: " + "; ".join(errors))
        failures += 1
    else:
        print(f"PASS {path}")

if failures:
    print("IZAKHONO_READINESS_EVIDENCE=FAIL")
    raise SystemExit(4)

print("IZAKHONO_READINESS_EVIDENCE=PASS")
PY