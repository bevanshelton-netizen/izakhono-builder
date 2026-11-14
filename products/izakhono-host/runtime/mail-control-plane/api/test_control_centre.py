import asyncio

import pytest
from fastapi import HTTPException

import index


def test_control_centre_returns_live_inventory_without_fabricating_telemetry(monkeypatch):
    calls = 0

    async def fake_jmap(method_calls):
        nonlocal calls
        calls += 1
        method = method_calls[0][0]
        if method == "x:Domain/query":
            return {"methodResponses": [[method, {"ids": ["domain-1"]}, "tag"]]}
        if method == "x:Domain/get":
            return {"methodResponses": [[method, {"list": [{"id": "domain-1", "name": "izakhonoafrica.co.za"}]}, "tag"]]}
        if method == "x:Account/query":
            return {"methodResponses": [[method, {"ids": ["account-1"]}, "tag"]]}
        if method == "x:Account/get":
            return {"methodResponses": [[method, {"list": [{
                "id": "account-1",
                "name": "bevans",
                "domainId": "domain-1",
                "enabled": True,
                "emailSend": True,
                "usedQuota": 4096,
            }]}, "tag"]]}
        raise AssertionError(f"Unexpected JMAP method: {method}")

    async def fake_checks(domain):
        return {
            "ownership": "passed", "mx": "passed", "spf": "passed",
            "dkim": "passed", "dmarc": "passed", "mtaSts": "passed",
            "mtaStsPolicy": "passed", "tlsRpt": "passed", "smtp": "passed",
            "submissionTls": "passed", "imapTls": "passed", "backup": "pending",
            "fortress": "pending", "monitoring": "pending",
        }

    monkeypatch.setattr(index, "jmap", fake_jmap)
    monkeypatch.setattr(index, "domain_operational_checks", fake_checks)
    monkeypatch.setattr(index, "domain_verified_at", lambda domain: 1760000000)

    result = asyncio.run(index.control_centre())

    assert calls == 4
    assert result["summary"]["managedDomains"] == 1
    assert result["summary"]["verifiedDomains"] == 1
    assert result["summary"]["activeMailboxes"] == 1
    assert result["domains"][0]["status"] == "verified"
    assert result["mailboxes"][0]["address"] == "bevans@izakhonoafrica.co.za"
    assert result["mailboxes"][0]["deliveryFailures"] is None
    assert result["mailboxes"][0]["securityStatus"] == "not_monitored"
    assert result["summary"]["openSecurityAlerts"] is None
    assert result["telemetry"]["delivery"] == "not_connected"


def test_control_plane_token_rejects_wrong_credentials(monkeypatch):
    monkeypatch.setenv("CONTROL_PLANE_TOKEN", "expected-token")
    with pytest.raises(HTTPException) as error:
        index.require_control_plane_token("Bearer wrong-token")
    assert error.value.status_code == 401
