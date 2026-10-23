"""Runtime loader for the Provisioner adapter registry."""
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict


def load_registry(path: str | None = None) -> Dict[str, Any]:
    target = Path(path) if path else Path(__file__).parent / "adapters" / "registry.yaml"
    try:
        import yaml
    except ImportError as exc:
        raise RuntimeError("PyYAML is required to load the Provisioner registry") from exc
    with target.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict) or not isinstance(data.get("adapters"), dict):
        raise ValueError("Invalid Provisioner adapter registry")
    return data


if __name__ == "__main__":
    registry = load_registry()
    assert registry["policy"]["selection_order"][0] == "owned"
    print(f"ADAPTER_REGISTRY_RUNTIME: PASS ({len(registry['adapters'])} capabilities)")
