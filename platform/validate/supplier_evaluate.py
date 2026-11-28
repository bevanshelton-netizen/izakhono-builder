"""Fail-closed, role-specific supplier SKU comparison engine.

Reads local evaluation JSON only. No supplier contact, provider API, purchase,
provisioning, deployment, or production mutation is implemented.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

BASE_GATES = (
    "owner_control",
    "capacity",
    "security",
    "resilience",
    "supplier_transparency",
    "exit",
    "quote_clarity",
)
ROLE_GATES = {
    "mail": (
        "mail_policy",
        "inbound_tcp25",
        "outbound_tcp25",
        "mail_service_ports",
        "static_ipv4",
        "ptr_rdns",
        "multi_tenant_mail",
    ),
    "dns-secondary": ("failure_domain_separation", "udp_tcp53", "authenticated_axfr_ixfr"),
    "backup": ("independent_account", "backup_encryption", "restore_test"),
}
WEIGHTS = {
    "technicalFit": 20,
    "mailSuitability": 20,
    "securityControl": 15,
    "resilienceRecovery": 15,
    "costContractClarity": 15,
    "portabilityExit": 10,
    "supportLocationFit": 5,
}
ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "schemas/supplier-evaluation.schema.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_record(record: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(record),
        key=lambda error: list(map(str, error.absolute_path)),
    )
    return [
        f"/{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in errors
    ]


def assess_gates(record: dict[str, Any]) -> dict[str, Any]:
    required = list(BASE_GATES) + list(ROLE_GATES.get(record["role"], ()))
    gates = record["hardGates"]
    missing = [name for name in required if name not in gates]
    blockers: list[str] = [f"{name}: required gate is missing" for name in missing]
    passed: list[str] = []
    for name in required:
        if name not in gates:
            continue
        gate = gates[name]
        status = gate["status"]
        evidence = gate["evidenceStatus"]
        reference = gate.get("evidenceReference")
        if status != "pass":
            blockers.append(f"{name}: gate status is {status}")
        elif evidence != "verified":
            blockers.append(f"{name}: passing claim is not independently verified ({evidence})")
        elif not reference:
            blockers.append(f"{name}: verified gate has no evidence reference")
        else:
            passed.append(name)
    return {"required": required, "passed": passed, "blockers": blockers}


def score_record(record: dict[str, Any]) -> dict[str, Any]:
    gate_result = assess_gates(record)
    scores = record["weightedScores"]
    incomplete: list[str] = []
    weighted_total = 0.0
    breakdown: dict[str, Any] = {}
    for category, weight in WEIGHTS.items():
        item = scores[category]
        if item["evidenceStatus"] != "verified" or not item.get("evidenceReference"):
            incomplete.append(category)
            continue
        points = item["value"] / 5 * weight
        weighted_total += points
        breakdown[category] = {
            "rawScore": item["value"],
            "weight": weight,
            "weightedPoints": round(points, 2),
        }

    if gate_result["blockers"]:
        status = "BLOCKED_HARD_GATES"
        total = None
        decision = "not-eligible"
    elif incomplete:
        status = "INCOMPLETE_WEIGHTED_EVIDENCE"
        total = None
        decision = "not-ranked"
    else:
        total = round(weighted_total, 2)
        status = "SCORED"
        if total >= 85:
            decision = "preferred-pilot-candidate"
        elif total >= 70:
            decision = "reserve-candidate"
        elif total >= 50:
            decision = "weak-candidate"
        else:
            decision = "reject-for-role"

    commercial = record["commercial"]
    quote_complete = all(
        commercial.get(key) is not None
        for key in ("currency", "upfrontAmount", "recurringMonthly", "renewalMonthly", "vatIncluded", "termMonths")
    )
    return {
        "supplierId": record["supplierId"],
        "supplierName": record["supplierName"],
        "sku": record["sku"],
        "role": record["role"],
        "status": status,
        "decision": decision,
        "hardGates": gate_result,
        "weightedTotal": total,
        "weightedBreakdown": breakdown,
        "incompleteWeightedEvidence": incomplete,
        "commercialDisclosureComplete": quote_complete,
        "commercial": commercial,
        "purchaseApproval": record["purchaseApproval"],
        "purchasePermitted": False,
        "notes": [
            "A weighted score cannot override a failed, unknown, or unverified mandatory gate.",
            "Supplier claims are not treated as independently verified evidence.",
            "This evaluation is a comparison aid, not supplier approval, purchase authorization, or deployment authorization.",
        ],
    }


def compare_records(records: list[dict[str, Any]], schema: dict[str, Any]) -> dict[str, Any]:
    evaluations: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    for record in records:
        errors = validate_record(record, schema)
        if errors:
            invalid.append({
                "supplierId": record.get("supplierId", "unknown"),
                "sku": record.get("sku", "unknown"),
                "errors": errors,
            })
        else:
            evaluations.append(score_record(record))

    evaluations.sort(
        key=lambda item: (
            item["weightedTotal"] is None,
            -(item["weightedTotal"] or 0),
            item["supplierId"],
            item["sku"],
        )
    )
    return {
        "apiVersion": "hosting.izakhono.africa/supplier-comparison-v1",
        "kind": "SupplierComparison",
        "rankingScope": "exact SKU and workload role; eligible and fully evidenced records only",
        "evaluations": evaluations,
        "invalidRecords": invalid,
        "supplierSelectionMade": False,
        "purchaseAuthorizationGranted": False,
        "deploymentPerformed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if not args.input_dir.is_dir():
            raise ValueError(f"input directory does not exist: {args.input_dir}")
        schema = load_json(SCHEMA_PATH)
        Draft202012Validator.check_schema(schema)
        records = [load_json(path) for path in sorted(args.input_dir.glob("*.json"))]
        result = compare_records(records, schema)
        rendered = json.dumps(result, indent=2, sort_keys=True)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered + "\n", encoding="utf-8")
        else:
            print(rendered)
        return 1 if result["invalidRecords"] else 0
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"SUPPLIER EVALUATION ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
