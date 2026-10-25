"""Capability-specific production adapter boundary for IZAKHONO Provisioner.

The catalog is the fail-closed registration boundary for real production
adapters. Credentials are represented only by secret references; adapters
resolve runtime configuration at execution time.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Mapping

from production_adapter_contract import ProductionAdapter
from production_payment_adapter import IzakhonoPayProductionAdapter

CAPABILITIES = (
    "tenant", "payment", "domain", "dns", "site", "tls", "mail",
    "crm_whatsapp", "forms", "payment_links", "acceptance",
)


@dataclass(frozen=True)
class AdapterRegistration:
    capability: str
    adapter: ProductionAdapter
    healthcheck: str
    credentials_ref: str | None = None

    def validate(self) -> None:
        if self.capability not in CAPABILITIES:
            raise ValueError(f"CAPABILITY_UNSUPPORTED:{self.capability}")
        if self.adapter.capability != self.capability:
            raise ValueError("ADAPTER_CAPABILITY_MISMATCH")
        if self.adapter.ownership not in {"owned", "approved_external"}:
            raise ValueError("ADAPTER_OWNERSHIP_INVALID")
        if not self.adapter.reversible:
            raise ValueError("ADAPTER_REQUIRES_RECONCILIATION")
        if not self.healthcheck:
            raise ValueError("ADAPTER_HEALTHCHECK_REQUIRED")


class ProductionAdapterCatalog:
    def __init__(self, registrations: Mapping[str, AdapterRegistration]):
        self.registrations = dict(registrations)
        for registration in self.registrations.values():
            registration.validate()

    def get(self, capability: str) -> AdapterRegistration:
        registration = self.registrations.get(capability)
        if registration is None:
            raise KeyError(f"PRODUCTION_ADAPTER_UNAVAILABLE:{capability}")
        return registration

    def capabilities(self) -> tuple[str, ...]:
        return tuple(sorted(self.registrations))


def build_production_catalog() -> ProductionAdapterCatalog:
    """Build the production catalog with the canonical owned PAY adapter."""
    payment = IzakhonoPayProductionAdapter()
    return ProductionAdapterCatalog({
        "payment": AdapterRegistration(
            "payment",
            payment,
            "izakhono-pay.health",
            "vault://izakhono-pay/credentials",
        )
    })


def smoke() -> None:
    class ReferenceAdapter:
        name = "reference"
        capability = "site"
        ownership = "owned"
        reversible = True
        def execute(self, request):
            raise NotImplementedError
        def reconcile(self, request):
            raise NotImplementedError

    catalog = ProductionAdapterCatalog({
        "site": AdapterRegistration("site", ReferenceAdapter(), "site.readiness", "secret://site")
    })
    assert catalog.get("site").credentials_ref == "secret://site"
    production = build_production_catalog()
    payment = production.get("payment")
    assert payment.adapter.name == "izakhono-pay"
    assert payment.adapter.ownership == "owned"
    assert payment.adapter.reversible is True
    try:
        catalog.get("mail")
    except KeyError:
        print("PRODUCTION_ADAPTER_CATALOG: PASS")
        return
    raise AssertionError("missing production adapter was not blocked")


if __name__ == "__main__":
    smoke()
