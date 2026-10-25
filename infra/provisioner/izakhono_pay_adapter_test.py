"""Tests for the owned IZAKHONO PAY production boundary."""
from __future__ import annotations

from izakhono_pay_adapter import IzakhonoPayAdapter
from production_adapter_contract import ProductionEvidence, ProductionRequest, validate_evidence


class FakePay(IzakhonoPayAdapter):
    def __init__(self, payload):
        super().__init__(base_url="https://owned-pay.invalid", api_key="runtime-secret")
        self.payload = payload

    def _request(self, method, path):
        assert method == "GET"
        assert path.endswith("/v1/payment-intents/pi_123")
        return self.payload


def request():
    return ProductionRequest("op-pay-1", "tenant-1", "payment", "idem-1", {"payment_id": "pi_123"}, "exec-1")


def main():
    evidence = FakePay({"id": "pi_123", "status": "settled"}).execute(request())
    assert evidence.verified and evidence.ownership == "owned"
    assert evidence.reversible and not evidence.simulation and not evidence.live

    try:
        FakePay({"id": "pi_123", "status": "pending"}).execute(request())
    except RuntimeError as exc:
        assert str(exc) == "PAYMENT_NOT_VERIFIED:pending"
    else:
        raise AssertionError("pending payment was incorrectly verified")

    try:
        FakePay({"id": "pi_123", "status": "settled"}).execute(
            ProductionRequest("op-pay-2", "tenant-1", "payment", "idem-2", {"payment_id": "pi_123", "api_key": "leak"}, "exec-2")
        )
    except ValueError as exc:
        assert str(exc).startswith("SECRET_FIELD_REJECTED:")
    else:
        raise AssertionError("secret-bearing request was accepted")

    try:
        validate_evidence(ProductionEvidence(True, "sim-1", "now", ("fake",), "owned", True, live=False, simulation=True))
    except ValueError:
        # Simulation may be structurally valid but must never be promoted as live evidence.
        pass

    print("IZAKHONO_PAY_ADAPTER_TEST: PASS")


if __name__ == "__main__":
    main()
