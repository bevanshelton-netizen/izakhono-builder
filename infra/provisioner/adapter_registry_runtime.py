"""Runtime loader for the Provisioner adapter registry and capability bindings."""
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict


def _yaml(path: Path) -> Dict[str, Any]:
    try:
        import yaml
    except ImportError as exc:
        raise RuntimeError("PyYAML is required to load the Provisioner registry") from exc
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML mapping: {path}")
    return data


def load_registry(path: str | None = None, bindings_path: str | None = None) -> Dict[str, Any]:
    target = Path(path) if path else Path(__file__).parent / "adapters" / "registry.yaml"
    data = _yaml(target)
    if not isinstance(data.get("adapters"), dict):
        raise ValueError("Invalid Provisioner adapter registry")
    selection_policy = data.get("selection_policy")
    if not isinstance(selection_policy, dict):
        raise ValueError("Invalid Provisioner selection policy")
    if selection_policy.get("order") != ["owned", "approved_external", "unavailable"]:
        raise ValueError("Provisioner selection policy must be owned-first")
    data["policy"] = {"selection_order": list(selection_policy["order"])}
    binding_target = Path(bindings_path) if bindings_path else Path(__file__).parent / "capability_bindings.v1.yaml"
    if binding_target.exists():
        bindings = _yaml(binding_target)
        data["bindings"] = bindings.get("bindings", {})
        data["binding_policy"] = bindings.get("selection", {})
    return data


if __name__ == "__main__":
    registry = load_registry()
    assert registry["policy"]["selection_order"] == ["owned", "approved_external", "unavailable"]
    assert "tenant" in registry["bindings"]
    print(f"ADAPTER_REGISTRY_RUNTIME: PASS ({len(registry['adapters'])} capabilities, {len(registry['bindings'])} bindings)")
