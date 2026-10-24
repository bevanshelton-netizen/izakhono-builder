"""IZAKHONO PAY production adapter boundary.

This adapter is deliberately provider-neutral: IZAKHONO Provisioner owns the
contract and routing, while the payment service owns payment verification.
No credentials are accepted in request payloads or persisted here.
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
class PaymentVerificationConfig:
    endpoint: str
    credentials_ref: str
    timeout_seconds: float = 10.0

    @classmethod
    def from_environment(cls) -> "PaymentVerificationConfig":
        endpoint = os.getenv("IZAKHONO_PAY_VERIFY_ENDPOINT", "").strip()
        credentials_ref = os.getenv("IZAKHONO_PAY_CREDENTIALS_REF", "").strip()
        if not endpoint or not credentials_ref:
            raise RuntimeError("PAYMENT_ADAPTER_NOT_CONFIGURED")
        return cls(endpoint=endpoint, credentials_ref=credentials_ref)


class IzakhonoPayProductionAdapter(ProductionAdapter):
    name = "izakhono-pay"
    capability = "payment"
    ownership = "owned"
    reversible = True

    def __init__(
        self,
        config: PaymentVerificationConfig | None = None,
        transport: Callable[[str, Mapping[str, Any], float], Mapping[str, Any]] | None = None,
    ) -> None:
        self.config = config
        self._transport = transport or self._http_transport

    def healthcheck(self) -> bool:
        return bool(self.config and self.config.endpoint and self.config.credentials_ref)

    def execute(self, request: ProductionRequest) -> ProductionEvidence:
        validate_request(request)
        if request.capability != self.capability:
            raise ValueError("PAYMENT_CAPABILITY_MISMATCH")
        config = self.config or PaymentVerificationConfig.from_environment()
        payload = {
            "operation_id": request.operation_id,
            "tenant_id": request.tenant_id,
            "idempotency_key": request.idempotency_key,
            "execution_key": request.execution_key,
            "desired_state": dict(request.desired_state),
            "credentials_ref": config.credentials_ref,
        }
        result = self._transport(config.endpoint, payload, config.timeout_seconds)
        if result.get("verified") is not True:
            raise RuntimeError("PAYMENT_VERIFICATION_NOT_CONFIRMED")
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
        response_request = Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json", "X-IZAKHONO-Operation": str(payload["operation_id"])},
            method="POST",
        )
        with urlopen(response_request, timeout=timeout) as response:  # nosec B310: endpoint is explicit configuration
            decoded = json.loads(response.read().decode("utf-8"))
        if not isinstance(decoded, Mapping):
            raise RuntimeError("PAYMENT_ADAPTER_INVALID_RESPONSE")
        return decoded


if __name__ == "__main__":
    adapter = IzakhonoPayProductionAdapter(
        config=PaymentVerificationConfig("https://pay.invalid/verify", "vault://izakhono-pay/verify"),
        transport=lambda *_: {
            "verified": True,
            "evidence_id": "pay-ev-1",
            "observed_at": "test-time",
            "checks": ["payment.exists", "payment.amount_verified", "payment.status_verified"],
            "live": True,
            "simulation": False,
        },
    )
    evidence = adapter.execute(
        ProductionRequest("op-pay-1", "tenant-1", "payment", "idem-pay-1", {"payment_reference": "REF-1"}, "exec-pay-1")
    )
    assert evidence.verified and evidence.live and not evidence.simulation
    print("IZAKHONO_PAY_PRODUCTION_ADAPTER: PASS")
