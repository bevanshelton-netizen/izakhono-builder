"""Tests for the production execution bridge."""
from __future__ import annotations

from production_executor import ProductionExecutor
from production_adapter_contract import ProductionRequest


class FakePayment:
    name = "izakhono-pay"
    capability = "payment"
    ownership = "owned"
    reversible = True

    def execute(self, request):
        from production_adapter_contract import ProductionEvidence
        return ProductionEvidence(True, "pay-test", "now", ("payment.verified",), "owned", True)

    def reconcile(self, request):
        return self.execute(request)


class FakeRegistration:
    def __init__(self):
        self.adapter = FakePayment()


def main():
    executor = ProductionExecutor({"payment": FakeRegistration()})
    evidence = executor.execute(
        operation_id="op-1", tenant_id="tenant-1", capability="payment",
        desired_state={"payment_id": "pi_123"}, idempotency_key="idem-1",
        execution_key="exec-1",
    )
    assert evidence.verified
    assert evidence.ownership == "owned"
    assert evidence.reversible
    request = ProductionRequest("op-1", "tenant-1", "payment", "idem-1", {"payment_id": "pi_123"}, "exec-1")
    assert executor.reconcile(request).verified
    print("PRODUCTION_EXECUTOR_TEST: PASS")


if __name__ == "__main__":
    main()
