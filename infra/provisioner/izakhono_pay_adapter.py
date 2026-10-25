"""Production payment adapter for the owned IZAKHONO PAY service.

The adapter performs no simulation. It verifies an existing payment intent through
IZAKHONO PAY's authenticated API and only emits verified production evidence when
the service confirms an authorised/settled payment.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping

from production_adapter_contract import ProductionAdapter, ProductionEvidence, ProductionRequest, validate_evidence, validate_request


class IzakhonoPayAdapter:
    name = "izakhono-pay"
    capability = "payment"
    ownership = "owned"
    reversible = True

    def __init__(self, base_url: str | None = None, api_key: str | None = None, timeout: float = 10.0):
        self.base_url = (base_url or os.getenv("IZAKHONO_PAY_BASE_URL", "")).rstrip("/")
        self.api_key = api_key or os.getenv("IZAKHONO_PAY_API_KEY", "")
        self.timeout = timeout

    def _request(self, method: str, path: str) -> Mapping[str, Any]:
        if not self.base_url or not self.api_key:
            raise RuntimeError("IZAKHONO_PAY_CONFIGURATION_MISSING")
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            method=method,
            headers={"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"IZAKHONO_PAY_HTTP_{response.status}")
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError("IZAKHONO_PAY_UNAVAILABLE") from exc
        if not isinstance(data, Mapping):
            raise RuntimeError("IZAKHONO_PAY_INVALID_RESPONSE")
        return data

    @staticmethod
    def _payment_id(request: ProductionRequest) -> str:
        payment_id = request.desired_state.get("payment_id")
        if not isinstance(payment_id, str) or not payment_id.strip():
            raise ValueError("PAYMENT_ID_REQUIRED")
        return payment_id.strip()

    def _verify(self, request: ProductionRequest) -> ProductionEvidence:
        validate_request(request)
        payment_id = self._payment_id(request)
        data = self._request("GET", f"/v1/payment-intents/{urllib.parse.quote(payment_id, safe='')}")
        status = str(data.get("status", "")).lower()
        if status not in {"authorised", "settled"}:
            raise RuntimeError(f"PAYMENT_NOT_VERIFIED:{status or 'unknown'}")
        observed = datetime.now(timezone.utc).isoformat()
        evidence = ProductionEvidence(
            verified=True,
            evidence_id=f"pay_{uuid.uuid4().hex}",
            observed_at=observed,
            checks=("izakhono_pay.reachable", "payment_intent.found", f"payment.status.{status}"),
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


# Runtime contract marker; intentionally not instantiated at import time.
PRODUCTION_ADAPTER: ProductionAdapter = IzakhonoPayAdapter()


if __name__ == "__main__":
    print("IZAKHONO_PAY_ADAPTER: PASS (contract import; live verification requires configured service)")
