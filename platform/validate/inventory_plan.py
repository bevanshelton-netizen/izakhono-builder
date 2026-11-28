#!/usr/bin/env python3
"""Generate a deterministic, read-only placement plan from local JSON records.

This tool never calls providers, connects to hosts, executes commands, or deploys.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from validate import (
    DEFAULT_HOST_SCHEMA,
    DEFAULT_POLICY,
    DEFAULT_SERVICE_SCHEMA,
    host_policy_errors,
    load_json,
    schema_errors,
)

ROOT = Path(__file__).resolve().parents[2]


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cpu_cores(value: str) -> float:
    match = re.fullmatch(r"([1-9][0-9]*)(m)?", value)
    if not match:
        raise ValueError(f"unsupported CPU quantity: {value}")
    number = float(match.group(1))
    return number / 1000 if match.group(2) else number


def memory_gib(value: str) -> float:
    match = re.fullmatch(r"([1-9][0-9]*)(Mi|Gi)", value)
    if not match:
        raise ValueError(f"unsupported memory quantity: {value}")
    number = float(match.group(1))
    return number / 1024 if match.group(2) == "Mi" else number


def storage_gib(value: str) -> float:
    match = re.fullmatch(r"([1-9][0-9]*)(Gi|Ti)", value)
    if not match:
        raise ValueError(f"unsupported storage quantity: {value}")
    number = float(match.group(1))
    return number * 1024 if match.group(2) == "Ti" else number


def service_demand(service: dict[str, Any]) -> dict[str, float | int]:
    spec = service["spec"]
    replicas = spec["runtime"]["replicas"]
    resources = spec["runtime"]["resources"]
    persistent = sum(
        storage_gib(mount["size"])
        for mount in spec["storage"]["mounts"]
        if mount["persistent"]
    )
    return {
        "replicas": replicas,
        "cpuCores": cpu_cores(resources["cpu"]) * replicas,
        "memoryGiB": memory_gib(resources["memory"]) * replicas,
        "persistentStorageGiB": persistent,
    }


def eligible_host_reasons(
    host: dict[str, Any], environment: str, role: str, demand: dict[str, float | int]
) -> list[str]:
    reasons: list[str] = []
    if host.get("approvalState") != "approved":
        reasons.append("host is not approved")
    if host.get("environment") != environment:
        reasons.append(f"host environment is not {environment}")
    if role not in host.get("roles", []):
        reasons.append(f"host is not approved for role {role}")
    if not host.get("executionResourceId"):
        reasons.append("executionResourceId is missing")
    if host.get("operatingSystem", {}).get("supportStatus") != "supported":
        reasons.append("operating system is not verified as supported")
    if not host.get("evidenceReferences"):
        reasons.append("inventory evidenceReferences are missing")
    if not host.get("approvalReference"):
        reasons.append("host approvalReference is missing")

    capacity = host.get("capacity", {})
    for key, demand_key in (
        ("vcpus", "cpuCores"),
        ("memoryGiB", "memoryGiB"),
        ("storageGiB", "persistentStorageGiB"),
    ):
        available = capacity.get(key)
        needed = demand[demand_key]
        if available is None:
            reasons.append(f"capacity.{key} is unknown")
        elif available < needed:
            reasons.append(f"capacity.{key} is insufficient ({available} < {needed})")
    return reasons


def build_plan(
    service: dict[str, Any],
    hosts: list[dict[str, Any]],
    environment: str,
    role: str,
) -> dict[str, Any]:
    demand = service_demand(service)
    candidates: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []

    for host in sorted(hosts, key=lambda item: item.get("hostId", "")):
        reasons = eligible_host_reasons(host, environment, role, demand)
        if reasons:
            rejected.append({"hostId": host.get("hostId", "unknown"), "reasons": reasons})
        else:
            candidates.append(host)

    selected = candidates[0] if candidates else None
    body: dict[str, Any] = {
        "apiVersion": "hosting.izakhono.africa/plan-v1",
        "kind": "ReadOnlyDeploymentPlan",
        "executionPermitted": False,
        "deploymentPerformed": False,
        "status": "PLAN_READY" if selected else "BLOCKED_NO_ELIGIBLE_HOST",
        "service": {
            "name": service["metadata"]["name"],
            "version": service["metadata"]["version"],
            "environment": environment,
            "role": role,
        },
        "demand": demand,
        "selectedHost": (
            {
                "hostId": selected["hostId"],
                "provider": selected["provider"],
                "productSku": selected["productSku"],
                "region": selected["region"],
                "executionResourceId": selected["executionResourceId"],
            }
            if selected
            else None
        ),
        "rejectedHosts": rejected,
        "actions": [],
        "limitations": [
            "Inventory capacity is treated as schedulable capacity; keep it current and do not list total physical capacity as available.",
            "This plan does not inspect live resource utilisation, provider state, network reachability, or service dependencies.",
            "A plan is not deployment authorization and cannot be executed by this tool.",
        ],
    }
    body["planSha256"] = hashlib.sha256(canonical_json(body).encode("utf-8")).hexdigest()
    return body


def render_text(plan: dict[str, Any]) -> str:
    lines = [
        f"IZAKHONO HOST plan: {plan['status']}",
        f"Service: {plan['service']['name']}@{plan['service']['version']}",
        f"Environment / role: {plan['service']['environment']} / {plan['service']['role']}",
        (
            "Demand: "
            f"{plan['demand']['cpuCores']:g} vCPU, "
            f"{plan['demand']['memoryGiB']:g} GiB RAM, "
            f"{plan['demand']['persistentStorageGiB']:g} GiB persistent storage"
        ),
    ]
    selected = plan["selectedHost"]
    lines.append(
        f"Candidate: {selected['hostId']} ({selected['provider']} / {selected['region']})"
        if selected
        else "Candidate: none — no eligible approved execution host"
    )
    lines.append(f"Plan SHA-256: {plan['planSha256']}")
    lines.append("Execution permitted: NO")
    lines.append("Deployment performed: NO")
    for rejected in plan["rejectedHosts"]:
        lines.append(f"Rejected {rejected['hostId']}: " + "; ".join(rejected["reasons"]))
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", type=Path, required=True, help="service definition JSON")
    parser.add_argument("--host-dir", type=Path, required=True, help="directory of host inventory JSON files")
    parser.add_argument("--environment", choices=("development", "staging", "production"), required=True)
    parser.add_argument("--role", required=True, help="required inventory role, e.g. staging-app")
    parser.add_argument("--format", choices=("json", "text"), default="text")
    parser.add_argument("--output", type=Path, help="optional local plan output file")
    args = parser.parse_args()

    try:
        service = load_json(args.service)
        policy = load_json(DEFAULT_POLICY)
        service_errors = schema_errors(service, load_json(DEFAULT_SERVICE_SCHEMA), str(args.service))
        service_errors += [
            f"policy: {item}"
            for item in __import__("validate").service_policy_errors(service, policy, args.environment)
        ]
        if service_errors:
            raise ValueError("service validation failed: " + "; ".join(service_errors))
        if not args.host_dir.is_dir():
            raise ValueError(f"host inventory directory does not exist: {args.host_dir}")

        hosts: list[dict[str, Any]] = []
        for path in sorted(args.host_dir.glob("*.json")):
            host = load_json(path)
            errors = schema_errors(host, load_json(DEFAULT_HOST_SCHEMA), str(path))
            errors += [f"policy: {item}" for item in host_policy_errors(host, policy)]
            if errors:
                raise ValueError(f"invalid host inventory {path}: " + "; ".join(errors))
            hosts.append(host)

        plan = build_plan(service, hosts, args.environment, args.role)
        output = json.dumps(plan, indent=2, sort_keys=True) if args.format == "json" else render_text(plan)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output + "\n", encoding="utf-8")
        else:
            print(output)
        return 0 if plan["status"] == "PLAN_READY" else 3
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        print(f"PLAN ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
