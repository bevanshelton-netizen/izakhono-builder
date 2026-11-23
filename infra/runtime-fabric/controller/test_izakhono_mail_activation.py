#!/usr/bin/env python3
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from izakhono_mail_activation import (
    activate_izakhono_mail,
    load_contract,
    validate_gateway_registration,
)

CONTRACT = {
    "schema": "izakhono.runtime-fabric.workload.v1",
    "workload": "izakhono-mail",
    "environment": "production",
    "identity": {
        "logical_node_id": "NODE01",
        "identity_type": "software-runtime",
        "runtime_host_is_separate": True,
    },
    "runtime": {
        "mode": "node-agnostic",
        "preferred_nodes": ["node01", "node02", "node03", "node04"],
        "failover_order": ["node02", "node03", "node04"],
    },
    "execution": {
        "adapter": "node01-command-gateway",
        "required_capabilities": ["runtime.deploy", "mail.activate", "runtime.health"],
        "authorization": "FORTRESS",
        "audit_required": True,
        "arbitrary_shell_over_http": False,
    },
    "acceptance": {
        "runtime": ["registered-node", "containers-healthy"],
        "mail": ["send-receive-reply"],
        "security": ["fortress-authorization", "audit-trail"],
        "promotion": "LIVE_VERIFIED only after all runtime, security, DNS, TLS and end-to-end mail acceptance evidence passes",
    },
}


def contract_file():
    temp = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".json", delete=False)
    json.dump(CONTRACT, temp)
    temp.close()
    return Path(temp.name)


def registration(node="node02"):
    authorization_id = "fortress-auth-test-001"
    return {
        "status": "active",
        "adapter": "node01-command-gateway",
        "registration_id": "gateway-registration-test-001",
        "logical_node_id": "NODE01",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "capabilities": ["runtime.deploy", "mail.activate", "runtime.health"],
        "runtime": {
            "node_id": node,
            "execution_environment_id": "runtime-execution-env-test-01",
            "registered": True,
            "state": "healthy",
        },
        "authorization": {
            "provider": "FORTRESS",
            "decision": "allow",
            "workload": "izakhono-mail",
            "environment": "production",
            "tenant_id": "tenant-test",
            "authorization_id": authorization_id,
        },
        "audit": {
            "acknowledged": True,
            "event_id": "fortress-audit-test-001",
            "authorization_id": authorization_id,
        },
    }


def test_contract_requires_explicit_production_and_software_identity():
    path = contract_file()
    try:
        loaded = load_contract(path)
        assert loaded["environment"] == "production"
        assert loaded["identity"]["logical_node_id"] == "NODE01"
        assert loaded["identity"]["runtime_host_is_separate"] is True
    finally:
        path.unlink()


def test_missing_registration_lookup_fails_closed():
    path = contract_file()
    calls = []
    try:
        result = activate_izakhono_mail(
            path, {"node01": True}, None,
            lambda *_: calls.append("execute") or True,
            lambda *_: calls.append("accept") or True,
            tenant_id="tenant-test",
        )
        assert result.status == "BLOCKED"
        assert result.stage == "adapter-registration"
        assert calls == []
    finally:
        path.unlink()


def test_missing_execution_adapter_fails_closed():
    path = contract_file()
    try:
        result = activate_izakhono_mail(path, {"node01": True}, lambda *_: registration("node01"), None,
                                        lambda *_: True, tenant_id="tenant-test")
        assert result.status == "BLOCKED"
        assert result.stage == "adapter-execution"
    finally:
        path.unlink()


def test_missing_acceptance_adapter_fails_closed():
    path = contract_file()
    try:
        result = activate_izakhono_mail(path, {"node01": True}, lambda *_: registration("node01"),
                                        lambda *_: True, None, tenant_id="tenant-test")
        assert result.status == "BLOCKED"
        assert result.stage == "acceptance-registration"
    finally:
        path.unlink()


def test_inactive_registration_blocks_before_execution():
    path = contract_file()
    calls = []
    evidence = registration("node01")
    evidence["status"] = "inactive"
    try:
        result = activate_izakhono_mail(path, {"node01": True}, lambda *_: evidence,
                                        lambda *_: calls.append("execute") or True,
                                        lambda *_: calls.append("accept") or True, tenant_id="tenant-test")
        assert result.status == "BLOCKED"
        assert result.stage == "adapter-registration"
        assert calls == []
    finally:
        path.unlink()


def test_stale_registration_blocks_before_execution():
    evidence = registration()
    evidence["observed_at"] = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    try:
        validate_gateway_registration(evidence, "node02", CONTRACT, "tenant-test")
    except ValueError as exc:
        assert "stale" in str(exc)
    else:
        raise AssertionError("stale registration evidence was accepted")


def test_logical_node_cannot_be_used_as_execution_host():
    evidence = registration()
    evidence["runtime"]["execution_environment_id"] = "NODE01"
    try:
        validate_gateway_registration(evidence, "node02", CONTRACT, "tenant-test")
    except ValueError as exc:
        assert "separate execution environment" in str(exc)
    else:
        raise AssertionError("logical NODE01 identity was accepted as the execution host")


def test_fortress_denial_and_missing_audit_block():
    denied = registration()
    denied["authorization"]["decision"] = "deny"
    try:
        validate_gateway_registration(denied, "node02", CONTRACT, "tenant-test")
    except ValueError as exc:
        assert "FORTRESS" in str(exc)
    else:
        raise AssertionError("FORTRESS denial was accepted")

    wrong_tenant = registration()
    wrong_tenant["authorization"]["tenant_id"] = "another-tenant"
    try:
        validate_gateway_registration(wrong_tenant, "node02", CONTRACT, "tenant-test")
    except ValueError as exc:
        assert "FORTRESS" in str(exc)
    else:
        raise AssertionError("authorization for another tenant was accepted")

    missing_audit = registration()
    missing_audit["audit"]["acknowledged"] = False
    try:
        validate_gateway_registration(missing_audit, "node02", CONTRACT, "tenant-test")
    except ValueError as exc:
        assert "audit acknowledgement" in str(exc)
    else:
        raise AssertionError("missing audit acknowledgement was accepted")


def test_registered_callbacks_execute_on_selected_software_node():
    path = contract_file()
    calls = []
    try:
        result = activate_izakhono_mail(
            path,
            {"node01": False, "node02": True, "node03": True, "node04": True},
            lambda node, contract: registration(node),
            lambda node, contract, evidence: calls.append(
                ("gateway", node, contract["workload"], evidence["registration_id"])
            ) or True,
            lambda node, contract: calls.append(("acceptance", node, contract["workload"])) or True,
            tenant_id="tenant-test",
        )
        assert result.node == "node02"
        assert result.status == "READY_FOR_PROMOTION"
        assert calls == [
            ("gateway", "node02", "izakhono-mail", "gateway-registration-test-001"),
            ("acceptance", "node02", "izakhono-mail"),
        ]
    finally:
        path.unlink()


if __name__ == "__main__":
    test_contract_requires_explicit_production_and_software_identity()
    test_missing_registration_lookup_fails_closed()
    test_missing_execution_adapter_fails_closed()
    test_missing_acceptance_adapter_fails_closed()
    test_inactive_registration_blocks_before_execution()
    test_stale_registration_blocks_before_execution()
    test_logical_node_cannot_be_used_as_execution_host()
    test_fortress_denial_and_missing_audit_block()
    test_registered_callbacks_execute_on_selected_software_node()
    print("IZAKHONO MAIL RUNTIME FABRIC BINDING: PASS")
