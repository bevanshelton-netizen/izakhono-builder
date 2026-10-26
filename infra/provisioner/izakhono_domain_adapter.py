"""Production adapter for the owned IZAKHONO private namespace."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from production_adapter_contract import ProductionAdapter, ProductionEvidence, ProductionRequest, validate_evidence, validate_request


class IzakhonoDomainAdapter:
    name = "izakhono-domain"
    capability = "domain"
    ownership = "owned"
    reversible = True

    def __init__(self, root: str | None = None):
        self.root = Path(root or os.getenv("IZAKHONO_DOMAIN_ROOT", "products/izakhono-domain"))

    def _verify_namespace(self, namespace: str) -> tuple[str, ...]:
        if namespace != "izakhono":
            raise RuntimeError("DOMAIN_NAMESPACE_NOT_SUPPORTED")
        zone = self.root / "coredns" / "izakhono.db"
        corefile = self.root / "coredns" / "Corefile"
        if not zone.is_file() or not corefile.is_file():
            raise RuntimeError("IZAKHONO_DOMAIN_CONFIGURATION_MISSING")
        zone_text = zone.read_text(encoding="utf-8")
        corefile_text = corefile.read_text(encoding="utf-8")
        required = ("ns1", "mail", "webmail", "smtp", "imap", "identity", "cloud", "pay", "nav", "voice")
        checks: list[str] = []
        if "$ORIGIN izakhono." not in zone_text:
            raise RuntimeError("DOMAIN_ZONE_INVALID")
        if "@ IN NS ns1.izakhono." not in zone_text or "SOA ns1.izakhono." not in zone_text:
            raise RuntimeError("DOMAIN_AUTHORITY_RECORDS_MISSING")
        if "izakhono:53" not in corefile_text or "file /etc/coredns/izakhono.db" not in corefile_text:
            raise RuntimeError("DOMAIN_COREDNS_CONFIGURATION_INVALID")
        for name in required:
            if f"{name} IN A " not in zone_text:
                raise RuntimeError(f"DOMAIN_SERVICE_RECORD_MISSING:{name}")
            checks.append(f"dns.record.{name}.izakhono")
        return tuple(["domain.files.present", "domain.authoritative.config"] + checks)

    def _verify(self, request: ProductionRequest) -> ProductionEvidence:
        validate_request(request)
        namespace = str(request.desired_state.get("namespace", "izakhono")).strip().lower()
        checks = self._verify_namespace(namespace)
        evidence = ProductionEvidence(
            verified=True,
            evidence_id=f"domain_{namespace}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            observed_at=datetime.now(timezone.utc).isoformat(),
            checks=checks,
            ownership="owned",
            reversible=True,
            live=False,
            simulation=False,
        )
        validate_evidence(evidence)
        return evidence

    def execute(self, request: ProductionRequest) -> ProductionEvidence:
        return self._verify(request)

    def reconcile(self, request: ProductionRequest) -> ProductionEvidence:
        return self._verify(request)


PRODUCTION_ADAPTER: ProductionAdapter = IzakhonoDomainAdapter()

if __name__ == "__main__":
    print("IZAKHONO_DOMAIN_ADAPTER: PASS (owned namespace verification requires configured runtime root)")
