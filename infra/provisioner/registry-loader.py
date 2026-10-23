#!/usr/bin/env python3
"""Load and validate the Provisioner capability registry without dependencies."""
from __future__ import annotations

from pathlib import Path
from typing import Any


REQUIRED_CAPABILITIES = {
    "tenant", "payment", "domain", "dns", "site", "tls", "mail",
    "crm_whatsapp", "forms", "payment_links", "acceptance",
}


class RegistryError(RuntimeError):
    pass


def load_registry(path: str | Path) -> dict[str, Any]:
    """Load a restricted YAML registry using PyYAML when available.

    The loader deliberately validates the semantic contract after parsing;
    callers cannot execute an incomplete or malformed capability registry.
    """
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RegistryError("YAML_PARSER_UNAVAILABLE") from exc

    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    validate_registry(data)
    return data


def validate_registry(data: Any) -> None:
    if not isinstance(data, dict):
        raise RegistryError("REGISTRY_NOT_MAPPING")
    if data.get("version") != 1:
        raise RegistryError("UNSUPPORTED_REGISTRY_VERSION")
    policy = data.get("selection_policy")
    if not isinstance(policy, dict) or policy.get("order") != ["owned", "approved_external", "unavailable"]:
        raise RegistryError("INVALID_SELECTION_POLICY")
    adapters = data.get("adapters")
    if not isinstance(adapters, dict):
        raise RegistryError("ADAPTERS_NOT_MAPPING")
    missing = sorted(REQUIRED_CAPABILITIES - set(adapters))
    if missing:
        raise RegistryError(f"MISSING_CAPABILITIES:{','.join(missing)}")

    for capability, entry in adapters.items():
        if not isinstance(entry, dict):
            raise RegistryError(f"INVALID_ENTRY:{capability}")
        owned = entry.get("owned")
        external = entry.get("external", [])
        if not owned and not isinstance(external, list):
            raise RegistryError(f"INVALID_EXTERNALS:{capability}")
        for candidate in external:
            if not isinstance(candidate, dict) or not candidate.get("name"):
                raise RegistryError(f"INVALID_EXTERNAL_CANDIDATE:{capability}")


def demo() -> None:
    path = Path(__file__).with_name("adapters") / "registry.yaml"
    data = load_registry(path)
    validate_registry(data)
    print(f"REGISTRY_LOADER_SMOKE: PASS ({len(data['adapters'])} capabilities)")


if __name__ == "__main__":
    demo()
