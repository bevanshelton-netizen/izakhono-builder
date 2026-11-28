#!/usr/bin/env python3
"""Read-only schema and policy validation for IZAKHONO HOST fixtures/manifests."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SERVICE_SCHEMA = ROOT / "platform/validate/schemas/service-definition.schema.json"
DEFAULT_HOST_SCHEMA = ROOT / "platform/validate/schemas/execution-host-inventory.schema.json"
DEFAULT_POLICY = ROOT / "platform/validate/policies/hosting-policy.v1.json"
DEFAULT_SERVICES = ROOT / "platform/validate/fixtures/services"
DEFAULT_HOSTS = ROOT / "platform/validate/fixtures/hosts"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def schema_errors(document: Any, schema: dict[str, Any], label: str) -> list[str]:
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(document), key=lambda error: list(map(str, error.absolute_path)))
    return [
        f"{label}: /{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in errors
    ]


def service_policy_errors(document: dict[str, Any], policy: dict[str, Any], environment: str) -> list[str]:
    errors: list[str] = []
    metadata = document.get("metadata", {})
    spec = document.get("spec", {})
    image = spec.get("image", {})
    security = spec.get("security", {})
    registry = str(image.get("reference", "")).split("/", 1)[0]

    if registry not in policy["allowedImageRegistries"]:
        errors.append(f"image registry '{registry}' is not allowlisted")
    digest = image.get("digest", "")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", digest):
        errors.append("image must be pinned to a full lowercase sha256 digest")
    if any(str(image.get("reference", "")).endswith(":" + tag) for tag in policy["prohibitedImageTags"]):
        errors.append("mutable prohibited image tag is not allowed")

    required = policy["requiredServiceSecurity"]
    for key, expected in required.items():
        if security.get(key) is not expected:
            errors.append(f"security.{key} must be {str(expected).lower()}")

    annotations = metadata.get("annotations", {})
    if environment == "production" and policy["productionApprovalRequired"]:
        if not annotations.get("changeApprovalReference"):
            errors.append("production environment requires metadata.annotations.changeApprovalReference")

    for index, ingress in enumerate(spec.get("network", {}).get("ingress", [])):
        if ingress.get("exposure") == "public-approved" and policy["publicIngressApprovalRequired"]:
            if not ingress.get("approvalReference"):
                errors.append(f"network.ingress[{index}] public exposure requires approvalReference")

    return errors


def host_policy_errors(document: dict[str, Any], policy: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if document.get("approvalState") != "approved":
        return errors

    if not document.get("executionResourceId"):
        errors.append("approved host requires executionResourceId")
    if not document.get("productSku"):
        errors.append("approved host requires productSku")
    if not document.get("region"):
        errors.append("approved host requires region")
    if document.get("operatingSystem", {}).get("supportStatus") != "supported":
        errors.append("approved host requires a supported operating system")

    capacity = document.get("capacity", {})
    for key in ("vcpus", "memoryGiB", "storageGiB"):
        value = capacity.get(key)
        if value is None or value <= 0:
            errors.append(f"approved host requires positive capacity.{key}")

    if not document.get("evidenceReferences"):
        errors.append("approved host requires evidenceReferences")
    if not document.get("approvalReference"):
        errors.append("approved host requires approvalReference")
    return errors


def validate_directory(
    directory: Path,
    schema_path: Path,
    policy: dict[str, Any],
    kind: str,
    environment: str = "staging",
) -> tuple[int, list[str]]:
    if not directory.is_dir():
        return 0, [f"{kind}: directory does not exist: {directory}"]
    schema = load_json(schema_path)
    checked = 0
    errors: list[str] = []
    for path in sorted(directory.glob("*.json")):
        checked += 1
        try:
            document = load_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path}: invalid JSON: {exc}")
            continue
        label = str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
        errors.extend(schema_errors(document, schema, label))
        if not isinstance(document, dict):
            continue
        if kind == "service":
            errors.extend(f"{label}: policy: {item}" for item in service_policy_errors(document, policy, environment))
        elif kind == "host":
            errors.extend(f"{label}: policy: {item}" for item in host_policy_errors(document, policy))
    return checked, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service-dir", type=Path, default=DEFAULT_SERVICES)
    parser.add_argument("--host-dir", type=Path, default=DEFAULT_HOSTS)
    parser.add_argument("--service-schema", type=Path, default=DEFAULT_SERVICE_SCHEMA)
    parser.add_argument("--host-schema", type=Path, default=DEFAULT_HOST_SCHEMA)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--environment", choices=("development", "staging", "production"), default="staging")
    args = parser.parse_args()

    try:
        policy = load_json(args.policy)
        if policy.get("policyVersion") != "hosting-policy/v1":
            raise ValueError("unsupported or missing policyVersion")
        service_count, service_errors = validate_directory(
            args.service_dir, args.service_schema, policy, "service", args.environment
        )
        host_count, host_errors = validate_directory(
            args.host_dir, args.host_schema, policy, "host", args.environment
        )
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"VALIDATION ERROR: {exc}", file=sys.stderr)
        return 2

    errors = service_errors + host_errors
    print(f"Checked {service_count} service manifest(s) and {host_count} execution-host record(s).")
    print(f"Environment policy: {args.environment}")
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        print(f"RESULT: FAIL — {len(errors)} validation/policy error(s).")
        return 1
    print("RESULT: PASS — schema and policy checks completed. This does not authorize or perform deployment.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
