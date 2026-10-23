"""Validate the normalized Provisioner execution/evidence envelope."""
from __future__ import annotations
from typing import Any, Mapping

REQUIRED_REQUEST = ("operation_id", "tenant_id", "capability", "idempotency_key")
REQUIRED_RESULT = ("operation_id", "capability", "adapter", "ownership", "status", "evidence")
REQUIRED_EVIDENCE = ("evidence_id", "observed_at", "verified", "checks")
SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}


def _reject_secrets(value: Any, path: str = "payload") -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if str(key).lower() in SECRET_FIELDS:
                raise ValueError(f"secret field prohibited at {path}.{key}")
            _reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_secrets(child, f"{path}[{index}]")


def validate_request(request: Mapping[str, Any]) -> None:
    _reject_secrets(request)
    missing = [key for key in REQUIRED_REQUEST if not request.get(key)]
    if missing:
        raise ValueError(f"missing request fields: {','.join(missing)}")


def validate_result(result: Mapping[str, Any], request: Mapping[str, Any]) -> None:
    _reject_secrets(result)
    missing = [key for key in REQUIRED_RESULT if key not in result]
    if missing:
        raise ValueError(f"missing result fields: {','.join(missing)}")
    if result["operation_id"] != request["operation_id"] or result["capability"] != request["capability"]:
        raise ValueError("execution identity mismatch")
    if result["ownership"] not in {"owned", "approved_external"}:
        raise ValueError("invalid ownership")
    evidence = result["evidence"]
    if not isinstance(evidence, Mapping):
        raise ValueError("evidence must be an object")
    missing_evidence = [key for key in REQUIRED_EVIDENCE if key not in evidence]
    if missing_evidence:
        raise ValueError(f"missing evidence fields: {','.join(missing_evidence)}")
    if result["status"] != "verified" or evidence["verified"] is not True:
        raise ValueError("execution evidence is not verified")


def smoke() -> None:
    request = {"operation_id": "op-1", "tenant_id": "t-1", "capability": "site", "idempotency_key": "i-1"}
    result = {"operation_id": "op-1", "capability": "site", "adapter": "izakhono-host", "ownership": "owned", "status": "verified", "evidence": {"evidence_id": "ev-1", "observed_at": "2026-10-23T00:00:00Z", "verified": True, "checks": ["site.reachable"]}}
    validate_request(request)
    validate_result(result, request)
    try:
        validate_request({**request, "token": "must-not-enter"})
    except ValueError:
        print("EXECUTION_CONTRACT_SMOKE: PASS")
        return
    raise AssertionError("secret rejection failed")


if __name__ == "__main__":
    smoke()
