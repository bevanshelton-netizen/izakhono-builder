"""Production execution bridge for the owned-first adapter catalog."""
from __future__ import annotations

from typing import Any, Mapping

from production_adapter_catalog import build_production_catalog
from production_adapter_contract import ProductionRequest, ProductionEvidence, validate_evidence


class ProductionExecutor:
    """Execute a registered production adapter with fail-closed evidence checks."""

    def __init__(self, catalog=None):
        self.catalog = catalog or build_production_catalog()

    def execute(
        self,
        *,
        operation_id: str,
        tenant_id: str,
        capability: str,
        desired_state: Mapping[str, Any],
        idempotency_key: str,
        execution_key: str,
    ) -> ProductionEvidence:
        registration = self.catalog.get(capability)
        request = ProductionRequest(
            operation_id, tenant_id, capability, idempotency_key,
            desired_state, execution_key,
        )
        evidence = registration.adapter.execute(request)
        validate_evidence(evidence)
        if evidence.ownership != registration.adapter.ownership:
            raise ValueError("EVIDENCE_OWNERSHIP_MISMATCH")
        if not evidence.reversible:
            raise ValueError("EVIDENCE_NOT_REVERSIBLE")
        return evidence

    def reconcile(self, request: ProductionRequest) -> ProductionEvidence:
        registration = self.catalog.get(request.capability)
        evidence = registration.adapter.reconcile(request)
        validate_evidence(evidence)
        return evidence


def smoke() -> None:
    catalog = build_production_catalog()
    payment = catalog.get("payment")
    assert payment.adapter.name == "izakhono-pay"
    assert payment.adapter.ownership == "owned"
    assert payment.adapter.reversible
    try:
        catalog.get("domain")
    except KeyError as exc:
        assert str(exc) == "'PRODUCTION_ADAPTER_UNAVAILABLE:domain'"
    else:
        raise AssertionError("unregistered production capability was not blocked")
    print("PRODUCTION_EXECUTOR: PASS")


if __name__ == "__main__":
    smoke()
