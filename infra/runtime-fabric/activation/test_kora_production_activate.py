import json
import os
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORCHESTRATOR = ROOT / "activation" / "KORA-PRODUCTION-ACTIVATE.sh"
WORKLOAD = ROOT / "workloads" / "kora-mail.json"


def executable_script(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_orchestrator(tmp_path: Path, gate_exit: int):
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    activator = tmp_path / "activator.sh"
    gate = tmp_path / "gate.sh"

    executable_script(activator, "#!/usr/bin/env bash\nset -Eeuo pipefail\necho activated > \"${KORA_TEST_MARKER}\"\n")
    executable_script(gate, f"#!/usr/bin/env bash\nset -Eeuo pipefail\nexit {gate_exit}\n")

    env = os.environ.copy()
    env.update({
        "IZAKHONO_NODE_ID": "node01",
        "KORA_PRODUCTION_EVIDENCE_DIR": str(evidence),
        "KORA_WORKLOAD_FILE": str(WORKLOAD),
        "KORA_MAIL_ACTIVATOR": str(activator),
        "KORA_MAIL_LIVE_GATE": str(gate),
        "KORA_TEST_MARKER": str(tmp_path / "activated.marker"),
    })
    result = subprocess.run([str(ORCHESTRATOR)], text=True, capture_output=True, env=env, check=False)
    return result, evidence


def test_pending_gate_is_not_failure(tmp_path):
    result, evidence = run_orchestrator(tmp_path, 2)
    assert result.returncode == 0
    payload = json.loads((evidence / "production-activation.json").read_text(encoding="utf-8"))
    assert payload["status"] == "ACTIVATED_AWAITING_EXTERNAL_ACCEPTANCE"
    assert payload["live_gate_exit_code"] == 2


def test_live_gate_failure_remains_blocked(tmp_path):
    result, evidence = run_orchestrator(tmp_path, 1)
    assert result.returncode == 1
    payload = json.loads((evidence / "production-activation.json").read_text(encoding="utf-8"))
    assert payload["status"] == "BLOCKED"
    assert payload["live_gate_exit_code"] == 1


def test_live_gate_success_is_live_verified(tmp_path):
    result, evidence = run_orchestrator(tmp_path, 0)
    assert result.returncode == 0
    payload = json.loads((evidence / "production-activation.json").read_text(encoding="utf-8"))
    assert payload["status"] == "LIVE_VERIFIED"
    assert payload["live_gate_exit_code"] == 0


def test_orchestrator_is_executable():
    assert ORCHESTRATOR.stat().st_mode & stat.S_IXUSR
