"""IZAKHONO Provisioner router-backed execution boundary v1.

The Provisioner selects an adapter from the owned-first registry, then invokes
only a registered capability executor. Concrete integrations stay outside the
orchestration layer.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Dict, Mapping
from hashlib import sha256

from service import ServiceError


@dataclass(frozen=True)
class AdapterExecution:
    operation_id: str
    capability: str
    adapter: str
    ownership: str
    execution_key: str
    evidence: Dict[str, Any]


class AdapterExecutionError(ServiceError):
    pass


class AdapterExecutor:
    def __init__(self, registry: Mapping[str, Any], implementations: Mapping[str, Callable[[Mapping[str, Any]], Mapping[str, Any]]]):
        self.registry = registry
        self.implementations = implementations

    def execute(self, *, operation_id: str, tenant_id: str, capability: str,
                desired_state: Mapping[str, Any], idempotency_key: str) -> AdapterExecution:
        entry = self.registry.get("adapters", {}).get(capability)
        if not entry:
            raise AdapterExecutionError("UNSUPPORTED_CAPABILITY", f"No adapter registered for {capability}")

        owned = entry.get("owned")
        if owned:
            adapter_name, ownership = str(owned), "owned"
        else:
            adapter_name, ownership = self._external(entry)

        implementation = self.implementations.get(adapter_name)
        if implementation is None:
            raise AdapterExecutionError("ADAPTER_NOT_IMPLEMENTED", adapter_name)

        raw = ":".join((tenant_id, operation_id, idempotency_key, capability, adapter_name))
        execution_key = "exec_" + sha256(raw.encode("utf-8")).hexdigest()[:32]
        try:
            evidence = dict(implementation({
                "operation_id": operation_id,
                "tenant_id": tenant_id,
                "capability": capability,
                "desired_state": dict(desired_state),
                "idempotency_key": idempotency_key,
                "execution_key": execution_key,
            }))
        except ServiceError:
            raise
        except Exception as exc:
            raise AdapterExecutionError("ADAPTER_EXECUTION_FAILED", str(exc)) from exc

        if evidence.get("verified") is not True:
            raise AdapterExecutionError("EVIDENCE_NOT_VERIFIED", capability)

        return AdapterExecution(operation_id, capability, adapter_name, ownership, execution_key, evidence)

    @staticmethod
    def _external(entry: Mapping[str, Any]) -> tuple[str, str]:
        for candidate in entry.get("external", []):
            if isinstance(candidate, Mapping) and candidate.get("enabled") is True and candidate.get("credentials_configured") is True:
                return str(candidate["name"]), "approved_external"
        raise AdapterExecutionError("POLICY_BLOCKED", "No approved executable adapter")


def demo() -> None:
    registry = {"adapters": {"site": {"owned": "izakhono-host", "external": []}}}
    executor = AdapterExecutor(registry, {"izakhono-host": lambda payload: {"verified": True, "site_id": "site-demo"}})
    result = executor.execute(operation_id="op-1", tenant_id="tenant-1", capability="site", desired_state={"template": "default"}, idempotency_key="idem-1")
    assert result.adapter == "izakhono-host"
    assert result.ownership == "owned"
    assert result.evidence["verified"] is True
    print("ADAPTER_EXECUTOR_SMOKE: PASS")


if __name__ == "__main__":
    demo()
