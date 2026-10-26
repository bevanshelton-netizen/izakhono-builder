"""Owned-first production adapter boundary for domain provisioning.

The Provisioner does not register or transfer domains itself. It calls the
configured IZAKHONO DOMAIN control plane, which must return independently
verifiable production evidence. Missing configuration, unverified results,
and simulation evidence fail closed.
"""
from __future__ import annotations

from dataclasses import dataclass
import json
import os
from typing import Any, Callable, Mapping
from urllib.request import Request, urlopen

from production_adapter_contract import (
    ProductionAdapter,
    ProductionEvidence,
    ProductionRequest,
    validate_evidence,
    validate_request,
)


@dataclass(frozen=True)
class DomainConfig:
    endpoint: str
    credentials_ref: str
    timeout_seconds: float = 10.0

    @classmethod
    def from_environment(cls) -> "DomainConfig":
        endpoint = os.getenv("IZAKHONO_DOMAIN_ENDPOINT", "").strip()
        credentials_ref = os.getenv("IZAKHONO_DOMAIN_CREDENTIALS_REF", "").strip()
        if not endpoint or not credentials_ref:
            raise RuntimeError("DOMAIN_ADAPTER_NOT_CONFIGURED")
        return cls(endpoint, credentials_ref)


class IzakhonoDomainProductionAdapter(ProductionAdapter):
    name = "izakhono-domain"
    capability = "domain"
    ownership = "owned"
    reversible = True

    def __init__(self, config: DomainConfig | None = None,
                 transport: Callable[[str, Mapping[str, Any], float], Mapping[str, Any]] | None = None) -> None:
        self.config = config
        self._transport = transport or self._http_transport

    def healthcheck(self) -> bool:
        return bool(self.config and self.config.endpoint and self.config.credentials_ref)

    @staticmethod
    def _domain(request: ProductionRequest) -> str:
        domain = request.desired_state.get("domain")
        if not isinstance(domain, str) or not domain.strip():
            raise ValueError("DOMAIN_REQUIRED")
        return domain.strip().lower()

    def execute(self, request: ProductionRequest) -> ProductionEvidence:
        validate_request(request)
        if request.capability != self.capability:
            raise ValueError("DOMAIN_CAPABILITY_MISMATCH")
        config = self.config or DomainConfig.from_environment()
        payload = {
            "operation_id": request.operation_id,
            "tenant_id": request.tenant_id,
            "idempotency_key": request.idempotency_key,
            "execution_key": request.execution_key,
            "domain": self._domain(request),
            "credentials_ref": config.credentials_ref,
        }
        result = self._transport(config.endpoint, payload, config.timeout_seconds)
        if result.get("verified") is not True:
            raise RuntimeError("DOMAIN_VERIFICATION_NOT_CONFIRMED")
        evidence = ProductionEvidence(
            verified=True,
            evidence_id=str(result.get("evidence_id", "")),
            observed_at=str(result.get("observed_at", "")),
            checks=tuple(str(item) for item in result.get("checks", ())),
            ownership="owned",
            reversible=True,
            live=bool(result.get("live", False)),
            simulation=bool(result.get("simulation", False)),
        )
        validate_evidence(evidence)
        if evidence.simulation:
            raise ValueError("SIMULATION_EVIDENCE_NOT_ACCEPTABLE_FOR_PRODUCTION")
        return evidence

    def reconcile(self, request: ProductionRequest) -> ProductionEvidence:
        return self.execute(request)

    @staticmethod
    def _http_transport(endpoint: str, payload: Mapping[str, Any], timeout: float) -> Mapping[str, Any]:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = Request(endpoint, data=body,
                      headers={"Content-Type": "application/json",
                               "X-IZAKHONO-Operation": str(payload["operation_id"])},
                      method="POST")
        with urlopen(req, timeout=timeout) as response:  # nosec B310: explicit configured control-plane endpoint
            decoded = json.loads(response.read().decode("utf-8"))
        if not isinstance(decoded, Mapping):
            raise RuntimeError("DOMAIN_ADAPTER_INVALID_RESPONSE")
        return decoded


PRODUCTION_ADAPTER: ProductionAdapter = IzakhonoDomainProductionAdapter()

if __name__ == "__main__":
    adapter = IzakhonoDomainProductionAdapter(
        config=DomainConfig("https://domain.invalid/provision", "vault://izakhono-domain/provision"),
        transport=lambda *_: {"verified": True, "evidence_id": "domain-ev-1",
                              "observed_at": "test-time", "checks": ["domain.request.accepted"],
                              "live": False, "simulation": False},
    )
    evidence = adapter.execute(ProductionRequest("op-domain-1", "tenant-1", "domain", "idem-domain-1",
                                                  {"domain": "example.co.za"}, "exec-domain-1"))
    assert evidence.verified and evidence.ownership == "owned" and not evidence.simulation
    print("IZAKHONO_DOMAIN_PRODUCTION_ADAPTER: PASS")
