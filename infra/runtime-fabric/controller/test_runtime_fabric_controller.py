import json
from pathlib import Path

from runtime_fabric_controller import decide, load_workload

ROOT = Path(__file__).resolve().parents[1]
WORKLOAD = ROOT / "workloads" / "kora-mail.json"


def test_kora_workload_contract():
    workload = load_workload(WORKLOAD)
    assert workload["workload"] == "kora-mail"
    assert workload["runtime"]["mode"] == "node-agnostic"
    assert workload["runtime"]["preferred_nodes"] == ["node01", "node02", "node03", "node04"]


def test_primary_selection():
    workload = load_workload(WORKLOAD)
    decision = decide(workload, {"node01": True, "node02": True, "node03": True, "node04": True})
    assert decision.selected_node == "node01"
    assert decision.status == "READY"


def test_failover_selection():
    workload = load_workload(WORKLOAD)
    decision = decide(workload, {"node01": False, "node02": True, "node03": True, "node04": True})
    assert decision.selected_node == "node02"


def test_all_nodes_block():
    workload = load_workload(WORKLOAD)
    decision = decide(workload, {"node01": False, "node02": False, "node03": False, "node04": False})
    assert decision.selected_node is None
    assert decision.status == "BLOCKED"


def test_no_secrets_in_controller_source():
    source = Path(__file__).with_name("runtime_fabric_controller.py").read_text(encoding="utf-8")
    assert "KORA_MAIL_PASSWORD" not in source
    assert "CLOUDFLARE_API_TOKEN" not in source
