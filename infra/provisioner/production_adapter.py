"""Strict production adapter boundary for IZAKHONO Provisioner.

Simulation adapters are intentionally incompatible with production execution.
A production adapter must prove readiness, execute with the supplied
idempotency/execution identity, return verified non-simulation evidence, and
provide a reconciliation hook for reversible capabilities.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping, Protocol


class ProductionAdapterError(RuntimeError):
    pass


@dataclass(frozen=True)
class AdapterContext:
    operation_id: str
    tenant_id: str
    capability: str
    idempotency_key: str
    execution_key: str
    desired_state: Mapping[str, Any]


class ProductionAdapter(Protocol):
    name: str
    capability: str
    ownership: str
    reversible: bool

    def readiness(self) -> Mapping[str, Any]: ...
    def execute(self, context: AdapterContext) -> Mapping[str, Any]: ...
    def reconcile(self, context: AdapterContext, reason: str) -> Mapping[str, Any]: ...


def validate_production_adapter(adapter: Any, capability: str, ownership: str) -> None:
    if getattr(adapter, "capability", None) != capability:
        raise ProductionAdapterError("CAPABILITY_MISMATCH")
    if getattr(adapter, "ownership", None) != ownership:
        raise ProductionAdapterError("OWNERSHIP_MISMATCH")
    for method in ("readiness", "execute", "reconcile"):
        if not callable(getattr(adapter, method, None)):
            raise ProductionAdapterError(f"ADAPTER_MISSING_{method.upper()}")
    if not isinstance(getattr(adapter, "reversible", None), bool):
        raise ProductionAdapterError("REVERSIBILITY_UNDECLARED")


def validate_readiness(result: Mapping[str, Any]) -> None:
    if result.get("ready") is not True:
        raise ProductionAdapterError("ADAPTER_NOT_READY")
    if result.get("simulation") is True:
        raise ProductionAdapterError("SIMULATION_NOT_ALLOWED")


def validate_evidence(evidence: Mapping[str, Any]) -> None:
    if evidence.get("verified") is not True:
        raise ProductionAdapterError("EVIDENCE_NOT_VERIFIED")
    if evidence.get("simulation") is True:
        raise ProductionAdapterError("SIMULATION_EVIDENCE_NOT_ALLOWED")
    for key in ("evidence_id", "observed_at", "checks"):
        if not evidence.get(key):
            raise ProductionAdapterError(f"EVIDENCE_MISSING_{key.upper()}")


class ProductionBoundary:
    def __init__(self, adapters: Mapping[str, ProductionAdapter]):
        self.adapters = dict(adapters)

    def execute(self, context: AdapterContext, ownership: str) -> Mapping[str, Any]:
        adapter = self.adapters.get(context.capability)
        if adapter is None:
            raise ProductionAdapterError("PRODUCTION_ADAPTER_UNAVAILABLE")
        validate_production_adapter(adapter, context.capability, ownership)
        validate_readiness(adapter.readiness())
        evidence = dict(adapter.execute(context))
        validate_evidence(evidence)
        return evidence

    def reconcile(self, context: AdapterContext, reason: str, ownership: str) -> Mapping[str, Any]:
        adapter = self.adapters.get(context.capability)
        if adapter is None:
            raise ProductionAdapterError("PRODUCTION_ADAPTER_UNAVAILABLE")
        validate_production_adapter(adapter, context.capability, ownership)
        if adapter.reversible is not True:
            raise ProductionAdapterError("REVERSAL_NOT_SUPPORTED")
        result = dict(adapter.reconcile(context, reason))
        if result.get("verified") is not True or result.get("simulation") is True:
            raise ProductionAdapterError("RECONCILIATION_NOT_VERIFIED")
        return result


if __name__ == "__main__":
    class Demo:
        name = "demo"
        capability = "site"
        ownership = "owned"
        reversible = True
        def readiness(self): return {"ready": True, "simulation": False}
        def execute(self, context): return {"evidence_id": "live-demo", "observed_at": "2026-10-24T00:00:00Z", "verified": True, "checks": ["site.ready"], "simulation": False}
        def reconcile(self, context, reason): return {"verified": True, "simulation": False, "evidence_id": "reconcile-demo"}
    ctx = AdapterContext("op", "tenant", "site", "idem", "exec", {})
    assert ProductionBoundary({"site": Demo()}).execute(ctx, "owned")["verified"] is True
    print("PRODUCTION_ADAPTER_BOUNDARY: PASS")
