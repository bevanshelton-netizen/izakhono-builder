#!/usr/bin/env python3
import json
import tempfile
from pathlib import Path

from izakhono_mail_activation import activate_izakhono_mail, load_contract

CONTRACT = {
    "schema": "izakhono.runtime-fabric.workload.v1",
    "workload": "izakhono-mail",
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


def test_missing_gateway_fails_closed():
    path = contract_file()
    try:
        result = activate_izakhono_mail(path, {"node01": True})
        assert result.status == "BLOCKED"
        assert result.stage == "adapter-registration"
    finally:
        path.unlink()


def test_missing_acceptance_adapter_fails_closed():
    path = contract_file()
    try:
        result = activate_izakhono_mail(path, {"node01": True}, lambda *_: True)
        assert result.status == "BLOCKED"
        assert result.stage == "acceptance-registration"
    finally:
        path.unlink()


def test_registered_callbacks_execute_on_selected_software_node():
    path = contract_file()
    calls = []
    try:
        result = activate_izakhono_mail(
            path,
            {"node01": False, "node02": True, "node03": True, "node04": True},
            lambda node, contract: calls.append(("gateway", node, contract["workload"])) or True,
            lambda node, contract: calls.append(("acceptance", node, contract["workload"])) or True,
        )
        assert result.node == "node02"
        assert result.status == "READY_FOR_PROMOTION"
        assert calls == [("gateway", "node02", "izakhono-mail"), ("acceptance", "node02", "izakhono-mail")]
    finally:
        path.unlink()


if __name__ == "__main__":
    test_missing_gateway_fails_closed()
    test_missing_acceptance_adapter_fails_closed()
    test_registered_callbacks_execute_on_selected_software_node()
    print("IZAKHONO MAIL RUNTIME FABRIC BINDING: PASS")
