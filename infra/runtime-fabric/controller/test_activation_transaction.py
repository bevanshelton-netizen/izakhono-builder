#!/usr/bin/env python3
from activation_transaction import run_transaction

WORKLOAD = {
    "workload": "kora-mail",
    "runtime": {
        "preferred_nodes": ["node01", "node02", "node03", "node04"],
    },
}


def test_selects_first_healthy_node():
    result = run_transaction(
        WORKLOAD,
        {"node01": False, "node02": True, "node03": True, "node04": True},
        lambda node: node == "node02",
        lambda node: node == "node02",
    )
    assert result.node == "node02"
    assert result.status == "READY_FOR_PROMOTION"


def test_activation_failure_blocks():
    result = run_transaction(
        WORKLOAD,
        {"node01": True},
        lambda _node: False,
        lambda _node: True,
    )
    assert result.status == "BLOCKED"
    assert result.stage == "activation"


def test_acceptance_failure_blocks():
    result = run_transaction(
        WORKLOAD,
        {"node01": True},
        lambda _node: True,
        lambda _node: False,
    )
    assert result.status == "BLOCKED"
    assert result.stage == "acceptance"


def test_no_healthy_node_blocks():
    result = run_transaction(
        WORKLOAD,
        {"node01": False, "node02": False, "node03": False, "node04": False},
        lambda _node: True,
        lambda _node: True,
    )
    assert result.status == "BLOCKED"
    assert result.stage == "selection"
