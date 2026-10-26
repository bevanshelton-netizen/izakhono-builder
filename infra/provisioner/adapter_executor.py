"""IZAKHONO Provisioner owned-first adapter execution boundary v1."""
from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Callable, Dict, Mapping, Iterator
from errors import ProvisionerError

@dataclass(frozen=True)
class AdapterExecution(Mapping[str, Any]):
    operation_id: str
    capability: str
    adapter: str
    ownership: str
    execution_key: str
    evidence: Dict[str, Any]

    def __getitem__(self, key: str) -> Any:
        if key == "status":
            return "verified" if self.evidence.get("verified") is True else "failed"
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return iter(("operation_id", "capability", "adapter", "ownership", "status", "evidence"))

    def __len__(self) -> int:
        return 6

class AdapterExecutionError(ProvisionerError):
    pass

class AdapterExecutor:
    def __init__(self, registry: Mapping[str, Any], implementations: Mapping[str, Callable[[Mapping[str, Any]], Mapping[str, Any]]]):
        self.registry = registry
        self.implementations = implementations

    def execute(self, request: Mapping[str, Any] | None = None, *, operation_id: str | None = None, tenant_id: str | None = None, capability: str | None = None, desired_state: Mapping[str, Any] | None = None, idempotency_key: str | None = None) -> AdapterExecution:
        if request is not None:
            operation_id = request.get("operation_id")
            tenant_id = request.get("tenant_id")
            capability = request.get("capability")
            desired_state = request.get("desired_state", {})
            idempotency_key = request.get("idempotency_key")
        if not all(isinstance(v, str) and v for v in (operation_id, tenant_id, capability, idempotency_key)):
            raise AdapterExecutionError("INVALID_EXECUTION_REQUEST", "missing execution identity")
        desired_state = desired_state or {}
        entry = self.registry.get("adapters", {}).get(capability)
        if not entry:
            raise AdapterExecutionError("UNSUPPORTED_CAPABILITY", f"No adapter registered for {capability}")
        owned = entry.get("owned")
        if owned:
            adapter_name, ownership = str(owned), "owned"
        else:
            adapter_name, ownership = self._external(entry)
        implementation = self.implementations.get(adapter_name) or self.implementations.get(capability)
        if implementation is None:
            raise AdapterExecutionError("ADAPTER_NOT_IMPLEMENTED", adapter_name)
        execution_key = "exec_" + sha256(":".join((tenant_id, operation_id, idempotency_key, capability, adapter_name)).encode()).hexdigest()[:32]
        try:
            evidence = dict(implementation({"operation_id": operation_id, "tenant_id": tenant_id, "capability": capability, "desired_state": dict(desired_state), "idempotency_key": idempotency_key, "execution_key": execution_key}))
        except ProvisionerError:
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

if __name__ == "__main__":
    registry = {"adapters": {"site": {"owned": "izakhono-host"}}}
    result = AdapterExecutor(registry, {"izakhono-host": lambda _: {"verified": True, "evidence_id": "ev-1", "observed_at": "now", "checks": ["site.ok"]}}).execute(operation_id="op-1", tenant_id="tenant-1", capability="site", desired_state={}, idempotency_key="idem-1")
    assert result.ownership == "owned" and result["status"] == "verified"
    print("ADAPTER_EXECUTOR_SMOKE: PASS")
