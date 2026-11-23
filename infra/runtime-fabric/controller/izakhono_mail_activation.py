#!/usr/bin/env python3
"""IZAKHONO MAIL activation binding for the existing Runtime Fabric.

NODE01 is a logical software-runtime identity. Activation is permitted only
after the runtime supplies fresh registration evidence for the real command-
gateway adapter, its separately registered execution environment, FORTRESS
authorization and audit acknowledgement. This module never invents endpoints
or executes arbitrary shell.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Mapping, Any

from activation_transaction import TransactionResult, run_transaction
from runtime_fabric_controller import decide

NODES = ("node01", "node02", "node03", "node04")
FAILOVER = ("node02", "node03", "node04")
REQUIRED_CAPABILITIES = {"runtime.deploy", "mail.activate", "runtime.health"}
REGISTRATION_MAX_AGE_SECONDS = 300


def load_contract(path: Path) -> dict:
    contract = json.loads(path.read_text(encoding="utf-8"))
    if contract.get("schema") != "izakhono.runtime-fabric.workload.v1":
        raise ValueError("unsupported Runtime Fabric workload schema")
    if contract.get("workload") != "izakhono-mail":
        raise ValueError("workload must be izakhono-mail")
    if contract.get("environment") != "production":
        raise ValueError("IZAKHONO MAIL production environment must be explicit")
    identity = contract.get("identity", {})
    if identity.get("logical_node_id") != "NODE01" or identity.get("identity_type") != "software-runtime":
        raise ValueError("NODE01 software identity contract is required")
    if identity.get("runtime_host_is_separate") is not True:
        raise ValueError("execution environment must remain separate from NODE01")
    runtime = contract.get("runtime", {})
    if runtime.get("mode") != "node-agnostic":
        raise ValueError("runtime mode must be node-agnostic")
    if tuple(runtime.get("preferred_nodes", ())) != NODES:
        raise ValueError("preferred node order must be node01..node04")
    if tuple(runtime.get("failover_order", ())) != FAILOVER:
        raise ValueError("invalid failover order")
    execution = contract.get("execution", {})
    if execution.get("adapter") != "node01-command-gateway":
        raise ValueError("NODE01 command-gateway adapter is required")
    if not REQUIRED_CAPABILITIES.issubset(set(execution.get("required_capabilities", ()))):
        raise ValueError("required gateway capabilities are incomplete")
    if execution.get("authorization") != "FORTRESS" or execution.get("audit_required") is not True:
        raise ValueError("FORTRESS authorization and audit are mandatory")
    if execution.get("arbitrary_shell_over_http") is not False:
        raise ValueError("arbitrary shell execution is prohibited")
    acceptance = contract.get("acceptance", {})
    if not acceptance.get("runtime") or not acceptance.get("mail") or not acceptance.get("security"):
        raise ValueError("runtime, mail and security acceptance gates are required")
    if "send-receive-reply" not in acceptance["mail"]:
        raise ValueError("end-to-end send/receive/reply acceptance is required")
    if not str(acceptance.get("promotion", "")).startswith("LIVE_VERIFIED only after all"):
        raise ValueError("promotion rule must remain fail-closed")
    return contract


def validate_gateway_registration(
    registration: Mapping[str, Any], selected_node: str, contract: Mapping[str, Any]
) -> None:
    """Validate a fresh gateway registry response before any deployment side effect."""
    if not isinstance(registration, Mapping):
        raise ValueError("gateway registration response must be a mapping")
    if registration.get("status") != "active":
        raise ValueError("NODE01 gateway adapter is not actively registered")
    if registration.get("adapter") != "node01-command-gateway":
        raise ValueError("registered adapter identity mismatch")
    if not registration.get("registration_id"):
        raise ValueError("gateway registration identifier is missing")
    if registration.get("logical_node_id") != "NODE01":
        raise ValueError("logical NODE01 identity is missing")

    observed_at = registration.get("observed_at")
    try:
        observed = datetime.fromisoformat(str(observed_at).replace("Z", "+00:00"))
        if observed.tzinfo is None:
            raise ValueError("timezone required")
    except (TypeError, ValueError) as exc:
        raise ValueError("gateway registration timestamp is invalid") from exc
    age = (datetime.now(timezone.utc) - observed.astimezone(timezone.utc)).total_seconds()
    if age < -30 or age > REGISTRATION_MAX_AGE_SECONDS:
        raise ValueError("gateway registration evidence is stale or from the future")

    capabilities = set(registration.get("capabilities", ()))
    if not REQUIRED_CAPABILITIES.issubset(capabilities):
        raise ValueError("registered gateway capabilities are incomplete")

    runtime = registration.get("runtime", {})
    execution_environment_id = str(runtime.get("execution_environment_id", "")).strip()
    if not execution_environment_id or execution_environment_id == "NODE01":
        raise ValueError("a separate execution environment must be registered")
    if runtime.get("node_id") != selected_node or runtime.get("registered") is not True:
        raise ValueError("selected runtime is not registered to the selected software node")
    if runtime.get("state") != "healthy":
        raise ValueError("registered execution environment is not healthy")

    authorization = registration.get("authorization", {})
    tenant_id = str(authorization.get("tenant_id", "")).strip()
    environment = str(contract.get("environment", "")).strip()
    if (
        authorization.get("provider") != "FORTRESS"
        or authorization.get("decision") != "allow"
        or authorization.get("workload") != contract.get("workload")
        or authorization.get("environment") != environment
        or not tenant_id
        or not authorization.get("authorization_id")
    ):
        raise ValueError("scoped FORTRESS authorization is absent or does not match the workload")

    audit = registration.get("audit", {})
    if (
        audit.get("acknowledged") is not True
        or not audit.get("event_id")
        or audit.get("authorization_id") != authorization.get("authorization_id")
    ):
        raise ValueError("FORTRESS audit acknowledgement is absent or mismatched")


def activate_izakhono_mail(
    contract_path: Path,
    health: Mapping[str, bool],
    gateway_registration: Callable[[str, Mapping], Mapping[str, Any]] | None = None,
    gateway_execute: Callable[[str, Mapping, Mapping[str, Any]], bool] | None = None,
    acceptance_check: Callable[[str, Mapping], bool] | None = None,
) -> TransactionResult:
    """Activate only through a registered, authorized gateway and fresh evidence.

    The registration callback must read the real NODE01 gateway/runtime registry.
    It must not synthesize a registration from repository configuration or CI.
    """
    contract = load_contract(contract_path)
    if not callable(gateway_registration):
        return TransactionResult("izakhono-mail", None, "BLOCKED", "adapter-registration",
                                 "live NODE01 gateway registration lookup unavailable")
    if not callable(gateway_execute):
        return TransactionResult("izakhono-mail", None, "BLOCKED", "adapter-execution",
                                 "registered NODE01 gateway execution adapter unavailable")
    if not callable(acceptance_check):
        return TransactionResult("izakhono-mail", None, "BLOCKED", "acceptance-registration",
                                 "runtime acceptance evidence adapter unavailable")

    decision = decide(dict(contract), dict(health))
    if decision.selected_node is None:
        return run_transaction(contract, health, lambda _node: False, lambda _node: False)

    selected_node = decision.selected_node
    try:
        registration = gateway_registration(selected_node, contract)
        validate_gateway_registration(registration, selected_node, contract)
    except Exception as exc:
        return TransactionResult("izakhono-mail", selected_node, "BLOCKED", "adapter-registration",
                                 str(exc) or "gateway registration verification failed")

    return run_transaction(
        contract,
        health,
        lambda node: gateway_execute(node, contract, registration),
        lambda node: acceptance_check(node, contract),
    )
