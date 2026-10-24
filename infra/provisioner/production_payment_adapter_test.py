"""Contract tests for the IZAKHONO PAY production adapter."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from production_adapter_contract import ProductionRequest
from production_payment_adapter import IzakhonoPayProductionAdapter, PaymentVerificationConfig


def request() -> ProductionRequest:
    return ProductionRequest(
        "op-pay-test", "tenant-test", "payment", "idem-pay-test",
        {"payment_reference": "REF-123", "amount": 548}, "exec-pay-test"
    )


def test_real_verified_evidence_is_accepted() -> None:
    adapter = IzakhonoPayProductionAdapter(
        PaymentVerificationConfig("https://pay.invalid/verify", "vault://izakhono-pay/verify"),
        lambda *_: {
            "verified": True, "evidence_id": "ev-real", "observed_at": "now",
            "checks": ["payment.exists", "payment.status_verified"],
            "live": True, "simulation": False,
        },
    )
    evidence = adapter.execute(request())
    assert evidence.verified and evidence.live and not evidence.simulation


def test_simulation_evidence_cannot_pass_production_boundary() -> None:
    adapter = IzakhonoPayProductionAdapter(
        PaymentVerificationConfig("https://pay.invalid/verify", "vault://izakhono-pay/verify"),
        lambda *_: {
            "verified": True, "evidence_id": "ev-sim", "observed_at": "now",
            "checks": ["payment.simulated"], "live": False, "simulation": True,
        },
    )
    try:
        adapter.execute(request())
    except ValueError as exc:
        assert str(exc) == "SIMULATION_EVIDENCE_NOT_ACCEPTABLE_FOR_PRODUCTION"
    else:
        raise AssertionError("simulation evidence was accepted")


def test_unverified_payment_is_blocked() -> None:
    adapter = IzakhonoPayProductionAdapter(
        PaymentVerificationConfig("https://pay.invalid/verify", "vault://izakhono-pay/verify"),
        lambda *_: {"verified": False},
    )
    try:
        adapter.execute(request())
    except RuntimeError as exc:
        assert str(exc) == "PAYMENT_VERIFICATION_NOT_CONFIRMED"
    else:
        raise AssertionError("unverified payment was accepted")


def test_missing_configuration_fails_closed() -> None:
    try:
        PaymentVerificationConfig.from_environment()
    except RuntimeError as exc:
        assert str(exc) == "PAYMENT_ADAPTER_NOT_CONFIGURED"
    else:
        raise AssertionError("missing payment configuration was accepted")


def test_request_secret_is_rejected() -> None:
    bad = ProductionRequest(
        "op", "tenant", "payment", "idem", {"token": "do-not-accept"}, "exec"
    )
    adapter = IzakhonoPayProductionAdapter(
        PaymentVerificationConfig("https://pay.invalid/verify", "vault://izakhono-pay/verify"),
        lambda *_: {},
    )
    try:
        adapter.execute(bad)
    except ValueError as exc:
        assert str(exc).startswith("SECRET_FIELD_REJECTED:")
    else:
        raise AssertionError("secret-bearing request was accepted")


if __name__ == "__main__":
    test_real_verified_evidence_is_accepted()
    test_simulation_evidence_cannot_pass_production_boundary()
    test_unverified_payment_is_blocked()
    test_missing_configuration_fails_closed()
    test_request_secret_is_rejected()
    print("IZAKHONO_PAY_PRODUCTION_ADAPTER_TEST: PASS")
