"""Provider-neutral adapter implementations for the Provisioner runtime.

These implementations are deliberately side-effect free. They establish the
runtime boundary and evidence shape without pretending that an external or
physical provider operation actually happened. Real service adapters can be
registered later behind the same contract.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Mapping


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _verified(capability: str, operation: str) -> dict[str, Any]:
    return {
        "evidence_id": f"sim-{capability}-{operation}",
        "observed_at": _now(),
        "verified": True,
        "checks": [f"adapter.contract.{capability}", "execution.contract.valid"],
        "simulation": True,
    }


def _implementation(capability: str):
    def run(payload: Mapping[str, Any]) -> Mapping[str, Any]:
        return _verified(capability, str(payload.get("operation", "operation")))
    return run


def build_provider_neutral_adapters() -> dict[str, Any]:
    """Return deterministic implementations for every owned capability.

    These are contract adapters, not live infrastructure operations. The
    `simulation` evidence flag prevents this layer from being mistaken for
    production acceptance evidence.
    """
    capabilities = (
        "izakhono-control", "izakhono-pay", "izakhono-domain", "izakhono-dns",
        "izakhono-host", "izakhono-edge", "izakhono-mail",
        "izakhono-integrations", "izakhono-forms", "izakhono-acceptance",
    )
    return {name: _implementation(name) for name in capabilities}


if __name__ == "__main__":
    adapters = build_provider_neutral_adapters()
    assert len(adapters) == 10
    print("PROVIDER_NEUTRAL_ADAPTERS: PASS")
