#!/usr/bin/env python3
from workload_activation import ActivationRequest, activate_workload

CONTRACT = {
    "schema": "izakhono.runtime-fabric.workload.v1",
    "workload": "kora-mail",
    "runtime": {
        "mode": "node-agnostic",
        "preferred_nodes": ["node01", "node02", "node03", "node04"],
        "failover_order": ["node02", "node03", "node04", "external-resilience"],
    },
    "acceptance": {
        "promotion": "LIVE_VERIFIED only after all acceptance gates pass"
    },
}


def test_customer_zero_fails_over_and_reaches_promotion_boundary():
    calls = []
    result = activate_workload(
        CONTRACT,
        ActivationRequest("kora-mail", {"node01": False, "node02": True, "node03": True, "node04": True}),
        lambda node: calls.append(("activate", node)) or True,
        lambda node: calls.append(("accept", node)) or True,
    )
    assert result.node == "node02"
    assert result.status == "READY_FOR_PROMOTION"
    assert calls == [("activate", "node02"), ("accept", "node02")]


def test_contract_cannot_weaken_promotion_rule():
    bad = dict(CONTRACT)
    bad["acceptance"] = {"promotion": "LIVE"}
    try:
        activate_workload(bad, ActivationRequest("kora-mail", {"node01": True}), lambda _: True, lambda _: True)
    except ValueError as exc:
        assert "promotion rule" in str(exc)
    else:
        raise AssertionError("weakened promotion rule was accepted")


if __name__ == "__main__":
    test_customer_zero_fails_over_and_reaches_promotion_boundary()
    test_contract_cannot_weaken_promotion_rule()
    print("WORKLOAD_ACTIVATION_BRIDGE: PASS")
