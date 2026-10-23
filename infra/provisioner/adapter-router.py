#!/usr/bin/env python3
"""IZAKHONO PROVISIONER adapter router v1.

Provider-neutral routing only. This module selects an adapter from the
registry and normalizes the execution boundary; provider credentials and
network calls remain inside concrete adapters.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from hashlib import sha256
from typing import Any, Mapping


class RouteStatus(str, Enum):
    SELECTED = "selected"
    BLOCKED = "blocked"


class RouteError(RuntimeError):
    pass


@dataclass(frozen=True)
class AdapterRef:
    capability: str
    name: str
    ownership: str
    status: RouteStatus = RouteStatus.SELECTED


@dataclass(frozen=True)
class RouteRequest:
    operation_id: str
    tenant_id: str
    capability: str
    desired_state: Mapping[str, Any]
    idempotency_key: str | None = None


@dataclass(frozen=True)
class RouteDecision:
    operation_id: str
    adapter: AdapterRef
    execution_key: str


class AdapterRouter:
    """Resolve capabilities according to the owned-first registry policy."""

    def __init__(self, registry: Mapping[str, Any]):
        self.registry = registry

    def select(self, request: RouteRequest) -> RouteDecision:
        self._validate(request)
        entry = self.registry.get("adapters", {}).get(request.capability)
        if not entry:
            raise RouteError("UNSUPPORTED_CAPABILITY")

        owned = entry.get("owned")
        if owned:
            adapter = AdapterRef(request.capability, owned, "owned")
            return RouteDecision(request.operation_id, adapter, self._execution_key(request, adapter))

        for candidate in entry.get("external", []):
            if not isinstance(candidate, Mapping):
                continue
            if candidate.get("enabled") is True and candidate.get("credentials_configured") is True:
                adapter = AdapterRef(request.capability, str(candidate["name"]), "approved_external")
                return RouteDecision(request.operation_id, adapter, self._execution_key(request, adapter))

        raise RouteError("POLICY_BLOCKED")

    @staticmethod
    def _validate(request: RouteRequest) -> None:
        if not request.operation_id or not request.tenant_id or not request.capability:
            raise RouteError("INVALID_REQUEST")
        if not isinstance(request.desired_state, Mapping):
            raise RouteError("INVALID_REQUEST")

    @staticmethod
    def _execution_key(request: RouteRequest, adapter: AdapterRef) -> str:
        raw = ":".join([
            request.tenant_id,
            request.operation_id,
            request.idempotency_key or request.operation_id,
            request.capability,
            adapter.name,
        ])
        return "exec_" + sha256(raw.encode("utf-8")).hexdigest()[:32]


def demo() -> None:
    registry = {"adapters": {"site": {"owned": "izakhono-host", "external": []}}}
    router = AdapterRouter(registry)
    decision = router.select(RouteRequest("op-001", "tenant-001", "site", {"template": "default"}))
    assert decision.adapter.name == "izakhono-host"
    assert decision.adapter.ownership == "owned"
    assert decision.execution_key.startswith("exec_")
    print("ADAPTER_ROUTER_SMOKE: PASS")


if __name__ == "__main__":
    demo()
