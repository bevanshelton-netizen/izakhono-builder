"""Capability-specific production adapter boundary for IZAKHONO Provisioner."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Mapping

from production_adapter_contract import ProductionAdapter
from production_payment_adapter import IzakhonoPayProductionAdapter
from domain_production_adapter import IzakhonoDomainProductionAdapter

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
    """Build the production catalog with canonical owned adapters."""
    return ProductionAdapterCatalog({
        "payment": AdapterRegistration(
            "payment", IzakhonoPayProductionAdapter(),
            "izakhono-pay.health", "vault://izakhono-pay/credentials"),
        "domain": AdapterRegistration(
            "domain", IzakhonoDomainProductionAdapter(),
            "izakhono-domain.health", "vault://izakhono-domain/credentials"),
    })


def smoke() -> None:
    production = build_production_catalog()
    payment = production.get("payment")
    domain = production.get("domain")
    assert payment.adapter.name == "izakhono-pay"
    assert payment.adapter.ownership == "owned"
    assert domain.adapter.name == "izakhono-domain"
    assert domain.adapter.ownership == "owned"
    try:
        production.get("mail")
    except KeyError:
        print("PRODUCTION_ADAPTER_CATALOG: PASS")
        return
    raise AssertionError("unimplemented production adapter was not blocked")


if __name__ == "__main__":
    smoke()
