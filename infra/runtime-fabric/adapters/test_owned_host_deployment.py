#!/usr/bin/env python3
from owned_host_deployment import deploy_to_owned_host


def test_healthy_deployment():
    calls = []
    result = deploy_to_owned_host(
        "node01",
        {"workload": "kora-mail"},
        lambda n, _: calls.append(("apply", n)) or True,
        lambda n, _: calls.append(("health", n)) or True,
        lambda n, _: calls.append(("rollback", n)) or True,
    )
    assert result.status == "DEPLOYED_HEALTHY"
    assert calls == [("apply", "node01"), ("health", "node01")]


def test_failed_health_rolls_back():
    calls = []
    result = deploy_to_owned_host(
        "node02",
        {"workload": "kora-mail"},
        lambda n, _: calls.append(("apply", n)) or True,
        lambda n, _: calls.append(("health", n)) or False,
        lambda n, _: calls.append(("rollback", n)) or True,
    )
    assert result.status == "ROLLED_BACK"
    assert result.rollback_required is True
    assert calls == [("apply", "node02"), ("health", "node02"), ("rollback", "node02")]


def test_failed_rollback_is_not_hidden():
    result = deploy_to_owned_host(
        "node03",
        {"workload": "kora-mail"},
        lambda *_: True,
        lambda *_: False,
        lambda *_: False,
    )
    assert result.status == "ROLLBACK_REQUIRED"
    assert result.rollback_required is True


def test_failed_apply_does_not_health_check_or_rollback():
    calls = []
    result = deploy_to_owned_host(
        "node04",
        {"workload": "kora-mail"},
        lambda n, _: calls.append(("apply", n)) or False,
        lambda n, _: calls.append(("health", n)) or True,
        lambda n, _: calls.append(("rollback", n)) or True,
    )
    assert result.status == "BLOCKED"
    assert calls == [("apply", "node04")]


if __name__ == "__main__":
    test_healthy_deployment()
    test_failed_health_rolls_back()
    test_failed_rollback_is_not_hidden()
    test_failed_apply_does_not_health_check_or_rollback()
    print("OWNED_HOST_DEPLOYMENT_ADAPTER_TESTS: PASS")
