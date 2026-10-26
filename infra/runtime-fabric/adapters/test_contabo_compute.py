#!/usr/bin/env python3
"""Offline tests for the Contabo compute adapter; no network or secrets required."""
from __future__ import annotations

import os

from contabo_compute import ContaboConfig, ContaboComputeClient


def test_env_contract() -> None:
    old = {key: os.environ.get(key) for key in (
        "CONTABO_CLIENT_ID", "CONTABO_CLIENT_SECRET",
        "CONTABO_API_USER", "CONTABO_API_PASSWORD",
    )}
    try:
        for key in old:
            os.environ.pop(key, None)
        try:
            ContaboConfig.from_env()
            raise AssertionError("missing credentials must be rejected")
        except ValueError as exc:
            assert "CONTABO_CLIENT_ID" in str(exc)
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_instance_summary() -> None:
    config = ContaboConfig("id", "secret", "user", "password")
    client = ContaboComputeClient(config)
    result = client.instance_summary({
        "data": [{
            "instanceId": 123,
            "name": "vps",
            "displayName": "CONTABO-VPS-01",
            "productId": "V161",
            "region": "EU",
            "status": "running",
            "privateData": "must not leak",
        }]
    })
    assert result == [{
        "instanceId": 123,
        "name": "vps",
        "displayName": "CONTABO-VPS-01",
        "productId": "V161",
        "region": "EU",
        "status": "running",
    }]


if __name__ == "__main__":
    test_env_contract()
    test_instance_summary()
    print("CONTABO_COMPUTE_ADAPTER: PASS")
