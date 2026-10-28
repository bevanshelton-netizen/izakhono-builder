import json
from pathlib import Path

from runtime_fabric_controller import activate, decide, load_workload

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


def make_temp_workload(tmp_path: Path) -> Path:
    runtime_fabric = tmp_path / "runtime-fabric"
    workloads = runtime_fabric / "workloads"
    workloads.mkdir(parents=True)
    path = workloads / "kora-mail.json"
    path.write_text(json.dumps({
        "workload": "kora-mail",
        "runtime": {
            "mode": "node-agnostic",
            "preferred_nodes": ["node01", "node02", "node03", "node04"],
            "failover_order": ["node02", "node03", "node04", "external-resilience"],
        },
    }), encoding="utf-8")
    return path


def make_temp_adapter(workload_path: Path) -> Path:
    adapter = workload_path.parents[1] / "activation" / "KORA-MAIL-ACTIVATE.sh"
    adapter.parent.mkdir(parents=True)
    adapter.write_text(
        "#!/usr/bin/env bash\n"
        "set -eu\n"
        "printf '%s' \"${IZAKHONO_NODE_ID}\" > \"${KORA_TEST_MARKER}\"\n",
        encoding="utf-8",
    )
    adapter.chmod(0o700)
    return adapter


def test_dry_run_does_not_execute_adapter(tmp_path, monkeypatch):
    workload = make_temp_workload(tmp_path)
    marker = tmp_path / "adapter-node"
    monkeypatch.setenv("KORA_TEST_MARKER", str(marker))

    result = activate(workload, {"node01": True}, execute=False)

    assert result.status == "PLANNED"
    assert result.selected_node == "node01"
    assert not marker.exists()


def test_execute_invokes_adapter_with_selected_node(tmp_path, monkeypatch):
    workload = make_temp_workload(tmp_path)
    make_temp_adapter(workload)
    marker = tmp_path / "adapter-node"
    monkeypatch.setenv("KORA_TEST_MARKER", str(marker))

    result = activate(workload, {"node01": False, "node02": True}, execute=True)

    assert result.status == "ACTIVATED"
    assert result.selected_node == "node02"
    assert marker.read_text(encoding="utf-8") == "node02"


def test_execute_blocks_when_adapter_is_missing(tmp_path):
    workload = make_temp_workload(tmp_path)
    result = activate(workload, {"node01": True}, execute=True)
    assert result.status == "BLOCKED"
    assert result.reason == "KORA activation adapter unavailable"
