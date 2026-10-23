"""Canonical adapter catalog for the IZAKHONO Provisioner."""
from __future__ import annotations
from typing import Any
from provider_adapters import build_provider_neutral_adapters

CAPABILITY_TO_ADAPTER = {
    "tenant": "izakhono-control",
    "payment": "izakhono-pay",
    "domain": "izakhono-domain",
    "dns": "izakhono-dns",
    "site": "izakhono-host",
    "tls": "izakhono-edge",
    "mail": "izakhono-mail",
    "crm_whatsapp": "izakhono-integrations",
    "forms": "izakhono-forms",
    "payment_links": "izakhono-pay",
    "acceptance": "izakhono-acceptance",
}


def build_catalog() -> dict[str, Any]:
    implementations = build_provider_neutral_adapters()
    missing = sorted({v for v in CAPABILITY_TO_ADAPTER.values()} - set(implementations))
    if missing:
        raise RuntimeError(f"Missing provider-neutral adapters: {missing}")
    return {capability: implementations[adapter] for capability, adapter in CAPABILITY_TO_ADAPTER.items()}


if __name__ == "__main__":
    catalog = build_catalog()
    assert len(catalog) == 11
    print("ADAPTER_CATALOG: PASS")
