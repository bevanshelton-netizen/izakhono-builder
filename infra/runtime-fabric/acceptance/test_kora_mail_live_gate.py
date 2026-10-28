import json
import os
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GATE = ROOT / "acceptance" / "KORA-MAIL-LIVE-GATE.sh"


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


def base_evidence(tmp_path: Path) -> Path:
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    write_json(evidence / "activation.json", {"workload": "kora-mail", "activated": True})
    write_json(evidence / "static-acceptance.json", {"passed": True})
    return evidence


def run_gate(evidence: Path):
    env = os.environ.copy()
    env["KORA_MAIL_EVIDENCE_DIR"] = str(evidence)
    return subprocess.run([str(GATE)], text=True, capture_output=True, env=env, check=False)


def test_missing_external_evidence_is_pending(tmp_path):
    result = run_gate(base_evidence(tmp_path))
    assert result.returncode == 2
    assert "PENDING" in result.stderr


def test_invalid_external_evidence_is_blocked(tmp_path):
    evidence = base_evidence(tmp_path)
    write_json(evidence / "inbound.json", {"received": True})
    write_json(evidence / "outbound.json", {"accepted": True})
    write_json(evidence / "reply.json", {"received": True})
    write_json(evidence / "authentication.json", {"passed": False, "spf": True, "dkim": True, "dmarc": True})
    result = run_gate(evidence)
    assert result.returncode == 1


def test_complete_external_evidence_is_live_verified(tmp_path):
    evidence = base_evidence(tmp_path)
    write_json(evidence / "inbound.json", {"received": True})
    write_json(evidence / "outbound.json", {"accepted": True})
    write_json(evidence / "reply.json", {"received": True})
    write_json(evidence / "authentication.json", {"passed": True, "spf": True, "dkim": True, "dmarc": True})
    result = run_gate(evidence)
    assert result.returncode == 0
    promotion = json.loads((evidence / "promotion.json").read_text(encoding="utf-8"))
    assert promotion["status"] == "LIVE_VERIFIED"


def test_gate_is_executable():
    mode = GATE.stat().st_mode
    assert mode & stat.S_IXUSR
