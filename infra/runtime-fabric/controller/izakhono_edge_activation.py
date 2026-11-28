"""Fail-closed NODE01/Runtime Fabric registration gate for IZAKHONO EDGE.

This validates evidence supplied by the real gateway/runtime adapters. It does
not create registrations, execute deployments, or treat repository config as
runtime proof. NODE01 remains a logical software identity; execution placement
is independently identified and attested by Runtime Fabric/HOST.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

SCHEMA = "izakhono.runtime-fabric.workload.v1"
WORKLOAD = "izakhono-edge"
ENVIRONMENT = "production"
LOGICAL_NODE = "NODE01"
REQUIRED_CAPABILITIES = frozenset({"runtime.deploy", "edge.activate", "runtime.health"})
REQUIRED_ROLES = frozenset({"primary", "secondary"})


def _parse_aware_timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("registration timestamp is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("registration timestamp is invalid") from exc
    if parsed.tzinfo is None:
        raise ValueError("registration timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def load_contract(contract: Mapping[str, Any]) -> None:
    if not isinstance(contract, Mapping) or contract.get("schema") != SCHEMA:
        raise ValueError("unsupported Runtime Fabric workload schema")
    if contract.get("workload") != WORKLOAD or contract.get("product") != WORKLOAD:
        raise ValueError("EDGE workload identity mismatch")
    if contract.get("environment") != ENVIRONMENT:
        raise ValueError("EDGE production environment must be explicit")

    identity = contract.get("identity", {})
    if (
        identity.get("logical_node_id") != LOGICAL_NODE
        or identity.get("identity_type") != "software-runtime"
        or identity.get("runtime_host_is_separate") is not True
    ):
        raise ValueError("NODE01 software identity and separate runtime host are mandatory")

    runtime = contract.get("runtime", {})
    if runtime.get("mode") != "node-agnostic" or runtime.get("binding_required") is not True:
        raise ValueError("node-agnostic verified runtime binding is mandatory")

    execution = contract.get("execution", {})
    if execution.get("adapter") != "node01-command-gateway":
        raise ValueError("canonical NODE01 command-gateway adapter is required")
    if not REQUIRED_CAPABILITIES.issubset(set(execution.get("required_capabilities", ()))):
        raise ValueError("required EDGE gateway capabilities are incomplete")
    if execution.get("authorization") != "FORTRESS" or execution.get("audit_required") is not True:
        raise ValueError("FORTRESS authorization and audit are mandatory")
    if execution.get("arbitrary_shell_over_http") is not False:
        raise ValueError("arbitrary shell over HTTP is prohibited")

    dns = contract.get("services", {}).get("authoritative_dns", {})
    if dns.get("provider") != "PowerDNS" or set(dns.get("roles", ())) != REQUIRED_ROLES:
        raise ValueError("PowerDNS primary and secondary roles are required")
    if dns.get("primary_secondary_separation_required") is not True:
        raise ValueError("DNS primary/secondary failure-domain separation is mandatory")
    if set(dns.get("required_placement_evidence", ())) != {
        "execution_environment_id", "network_failure_domain_id"
    }:
        raise ValueError("DNS placement evidence contract is incomplete")

    if not contract.get("acceptance", {}).get("runtime"):
        raise ValueError("runtime acceptance gates are required")
    if not str(contract.get("acceptance", {}).get("promotion", "")).startswith("LIVE_VERIFIED only after"):
        raise ValueError("promotion must remain fail-closed")


def validate_gateway_registration(
    registration: Mapping[str, Any],
    contract: Mapping[str, Any],
    expected_tenant_id: str,
    *,
    now: datetime | None = None,
    max_age_seconds: int = 300,
) -> dict[str, str]:
    """Validate fresh gateway registration, Runtime Fabric binding, FORTRESS and audit."""
    load_contract(contract)
    if not isinstance(registration, Mapping):
        raise ValueError("live gateway registration response is required")
    if registration.get("status") != "active":
        raise ValueError("NODE01 gateway adapter is not actively registered")
    if registration.get("adapter") != "node01-command-gateway":
        raise ValueError("registered gateway adapter identity mismatch")
    if not isinstance(registration.get("registration_id"), str) or not registration["registration_id"].strip():
        raise ValueError("gateway registration identifier is missing")
    if registration.get("logical_node_id") != LOGICAL_NODE:
        raise ValueError("logical NODE01 software identity mismatch")

    observed = _parse_aware_timestamp(registration.get("observed_at"))
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    age = (current - observed).total_seconds()
    if age < -30 or age > max_age_seconds:
        raise ValueError("gateway registration evidence is stale or from the future")

    capabilities = set(registration.get("capabilities", ()))
    if not REQUIRED_CAPABILITIES.issubset(capabilities):
        raise ValueError("registered gateway capabilities are incomplete")

    runtime = registration.get("runtime", {})
    environment_id = runtime.get("execution_environment_id")
    if not isinstance(environment_id, str) or not environment_id.strip() or environment_id == LOGICAL_NODE:
        raise ValueError("separate execution environment identity is required")
    if runtime.get("registered") is not True or runtime.get("state") != "healthy":
        raise ValueError("Runtime Fabric execution environment is not registered and healthy")

    authorization = registration.get("authorization", {})
    if (
        authorization.get("provider") != "FORTRESS"
        or authorization.get("decision") != "allow"
        or authorization.get("tenant_id") != expected_tenant_id
        or authorization.get("workload") != WORKLOAD
        or authorization.get("environment") != ENVIRONMENT
        or not authorization.get("authorization_id")
    ):
        raise ValueError("exact tenant/workload/environment FORTRESS authorization is required")

    audit = registration.get("audit", {})
    if (
        audit.get("acknowledged") is not True
        or not audit.get("event_id")
        or audit.get("authorization_id") != authorization.get("authorization_id")
    ):
        raise ValueError("correlated FORTRESS audit acknowledgement is required")

    return {
        "registration_id": registration["registration_id"],
        "execution_environment_id": environment_id,
        "authorization_id": str(authorization["authorization_id"]),
        "audit_event_id": str(audit["event_id"]),
    }


def validate_dns_placement(primary: Mapping[str, Any], secondary: Mapping[str, Any]) -> None:
    """Require independent execution environments and network failure domains."""
    for role, evidence in (("primary", primary), ("secondary", secondary)):
        if not isinstance(evidence, Mapping):
            raise ValueError(f"DNS {role} placement evidence is missing")
        if not evidence.get("execution_environment_id") or not evidence.get("network_failure_domain_id"):
            raise ValueError(f"DNS {role} placement evidence is incomplete")
        if evidence.get("healthy") is not True:
            raise ValueError(f"DNS {role} workload is not healthy")
    if primary["execution_environment_id"] == secondary["execution_environment_id"]:
        raise ValueError("DNS primary and secondary share one execution environment")
    if primary["network_failure_domain_id"] == secondary["network_failure_domain_id"]:
        raise ValueError("DNS primary and secondary share one network failure domain")
