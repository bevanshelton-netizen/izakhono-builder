#!/usr/bin/env python3
"""IZAKHONO MAIL activation binding for the existing Runtime Fabric.

This module deliberately does not invent a gateway endpoint or execute shell.
The registered NODE01 command-gateway adapter and FORTRESS authorization layer
must be injected by the runtime. Without both activation and acceptance
callbacks, the result is BLOCKED.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Mapping

from activation_transaction import TransactionResult, run_transaction

NODES = ("node01", "node02", "node03", "node04")
FAILOVER = ("node02", "node03", "node04")


def load_contract(path: Path) -> dict:
    contract = json.loads(path.read_text(encoding="utf-8"))
    if contract.get("schema") != "izakhono.runtime-fabric.workload.v1":
        raise ValueError("unsupported Runtime Fabric workload schema")
    if contract.get("workload") != "izakhono-mail":
        raise ValueError("workload must be izakhono-mail")
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
    required = {"runtime.deploy", "mail.activate", "runtime.health"}
    if not required.issubset(set(execution.get("required_capabilities", ()))):
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


def activate_izakhono_mail(
    contract_path: Path,
    health: Mapping[str, bool],
    gateway_execute: Callable[[str, Mapping], bool] | None = None,
    acceptance_check: Callable[[str, Mapping], bool] | None = None,
) -> TransactionResult:
    """Activate only through registered, authorized gateway callbacks.

    Callback implementations must verify adapter registration, current runtime
    binding, FORTRESS authorization and audit acknowledgement. Acceptance must
    use fresh runtime evidence; repository/CI/configuration state is insufficient.
    """
    contract = load_contract(contract_path)
    if not callable(gateway_execute):
        return TransactionResult("izakhono-mail", None, "BLOCKED", "adapter-registration",
                                 "registered NODE01 command-gateway execution adapter unavailable")
    if not callable(acceptance_check):
        return TransactionResult("izakhono-mail", None, "BLOCKED", "acceptance-registration",
                                 "runtime acceptance evidence adapter unavailable")

    return run_transaction(
        contract,
        health,
        lambda node: gateway_execute(node, contract),
        lambda node: acceptance_check(node, contract),
    )
