"""Production adapter contract: explicit side effects, evidence and idempotency."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping, Protocol

SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}


def reject_secrets(value: Any, path: str = "payload") -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if str(key).lower() in SECRET_FIELDS:
                raise ValueError(f"SECRET_FIELD_REJECTED:{path}.{key}")
            reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            reject_secrets(child, f"{path}[{index}]")


@dataclass(frozen=True)
class ProductionRequest:
    operation_id: str
    tenant_id: str
    capability: str
    idempotency_key: str
    desired_state: Mapping[str, Any]
    execution_key: str


@dataclass(frozen=True)
class ProductionEvidence:
    verified: bool
    evidence_id: str
    observed_at: str
    checks: tuple[str, ...]
    ownership: str
    reversible: bool
    live: bool = False
    simulation: bool = False


class ProductionAdapter(Protocol):
    name: str
    capability: str
    ownership: str
    reversible: bool

    def execute(self, request: ProductionRequest) -> ProductionEvidence: ...

    def reconcile(self, request: ProductionRequest) -> ProductionEvidence: ...


def validate_request(request: ProductionRequest) -> None:
    if not all((request.operation_id, request.tenant_id, request.capability, request.idempotency_key, request.execution_key)):
        raise ValueError("PRODUCTION_REQUEST_INCOMPLETE")
    reject_secrets(request.desired_state)


def validate_evidence(evidence: ProductionEvidence) -> None:
    if not evidence.verified:
        raise ValueError("EVIDENCE_NOT_VERIFIED")
    if not evidence.evidence_id or not evidence.observed_at or not evidence.checks:
        raise ValueError("EVIDENCE_INCOMPLETE")
    if evidence.ownership not in {"owned", "approved_external"}:
        raise ValueError("OWNERSHIP_INVALID")
    if not evidence.reversible:
        raise ValueError("ADAPTER_NOT_REVERSIBLE")
    if evidence.live and evidence.simulation:
        raise ValueError("LIVE_SIMULATION_CONTRADICTION")


class ContractAdapter:
    """Reference adapter used only to prove the contract; it is never a live provider."""
    name = "contract-reference"
    capability = "site"
    ownership = "owned"
    reversible = True

    def execute(self, request: ProductionRequest) -> ProductionEvidence:
        validate_request(request)
        evidence = ProductionEvidence(True, f"ev_{request.execution_key}", "contract-time", ("contract.accepted",), self.ownership, True, live=False, simulation=True)
        validate_evidence(evidence)
        return evidence

    def reconcile(self, request: ProductionRequest) -> ProductionEvidence:
        return self.execute(request)


if __name__ == "__main__":
    req = ProductionRequest("op-1", "tenant-1", "site", "idem-1", {"hostname": "example.test"}, "exec-1")
    evidence = ContractAdapter().execute(req)
    assert evidence.verified and evidence.simulation and not evidence.live
    print("PRODUCTION_ADAPTER_CONTRACT: PASS")
