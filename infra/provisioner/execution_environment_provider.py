"""Execution-environment provider boundary and approval-gated coordinator.

No concrete cloud/vendor adapter is registered here. Provider implementations
must enforce idempotency at their API boundary and honor the approved cost cap.
Attestation promotion requires an independent evidence-verifier callback.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Mapping, Protocol

from execution_environment_provisioning import (
    ProvisioningApproval,
    ProvisioningPlan,
    ProvisioningPolicyError,
    create_plan,
    provision_authorization_envelope,
)


class ExecutionEnvironmentProvider(Protocol):
    provider_id: str

    def capabilities(self) -> Mapping[str, Any]: ...
    def provision(self, authorization: Mapping[str, Any]) -> Mapping[str, Any]: ...
    def inspect(self, resource_id: str) -> Mapping[str, Any]: ...
    def attest(self, resource_id: str) -> Mapping[str, Any]: ...
    def quarantine(self, resource_id: str, reason: str) -> None: ...
    def drain(self, resource_id: str) -> Mapping[str, Any]: ...
    def release(self, resource_id: str, authorization: Mapping[str, Any]) -> Mapping[str, Any]: ...


class ExecutionEnvironmentProviderRegistry:
    """Explicit provider registry; never chooses a provider implicitly."""

    def __init__(self, providers: Mapping[str, ExecutionEnvironmentProvider] | None = None):
        self._providers = dict(providers or {})
        for key, provider in self._providers.items():
            if key != provider.provider_id or not key.strip():
                raise ProvisioningPolicyError("PROVIDER_REGISTRATION_ID_MISMATCH")

    def register(self, provider: ExecutionEnvironmentProvider) -> None:
        if not provider.provider_id.strip() or provider.provider_id in self._providers:
            raise ProvisioningPolicyError("PROVIDER_REGISTRATION_INVALID_OR_DUPLICATE")
        self._providers[provider.provider_id] = provider

    def resolve(self, provider_id: str) -> ExecutionEnvironmentProvider:
        provider = self._providers.get(provider_id)
        if provider is None:
            raise ProvisioningPolicyError(f"PROVIDER_ADAPTER_UNAVAILABLE:{provider_id}")
        return provider

    def provider_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._providers))


class ExecutionEnvironmentProvisioningCoordinator:
    """Coordinates planning, approved provisioning and evidence-gated eligibility."""

    def __init__(
        self,
        registry: ExecutionEnvironmentProviderRegistry,
        fortress_authorize: Callable[[ProvisioningApproval, ProvisioningPlan], bool],
    ):
        if not callable(fortress_authorize):
            raise ProvisioningPolicyError("FORTRESS_AUTHORIZER_REQUIRED")
        self._registry = registry
        self._fortress_authorize = fortress_authorize

    def plan(self, request: Mapping[str, Any], *, now: str) -> ProvisioningPlan:
        provider_id = request.get("provider")
        if not isinstance(provider_id, str) or not provider_id:
            raise ProvisioningPolicyError("EXPLICIT_PROVIDER_REQUIRED")
        provider = self._registry.resolve(provider_id)
        capability = provider.capabilities()
        if not isinstance(capability, Mapping):
            raise ProvisioningPolicyError("PROVIDER_CAPABILITY_RESPONSE_INVALID")
        return create_plan(request, capability, now=now)

    def provision(
        self,
        plan: ProvisioningPlan,
        approval: ProvisioningApproval,
        *,
        now: str,
    ) -> Mapping[str, Any]:
        authorization = provision_authorization_envelope(plan, approval, now=now)
        if self._fortress_authorize(approval, plan) is not True:
            raise ProvisioningPolicyError("FORTRESS_AUTHORIZATION_DENIED")
        provider = self._registry.resolve(plan.provider)
        result = provider.provision(authorization)
        if not isinstance(result, Mapping):
            raise ProvisioningPolicyError("PROVIDER_PROVISION_RESULT_INVALID")
        required = ("resource_id", "provider_id", "region", "resource_class", "environment", "currency", "recurring_cost", "idempotency_key")
        if any(not result.get(key) for key in required):
            raise ProvisioningPolicyError("PROVIDER_PROVISION_RESULT_INCOMPLETE")
        if result["provider_id"] != plan.provider or result["region"] != plan.region:
            raise ProvisioningPolicyError("PROVIDER_RESOURCE_BINDING_MISMATCH")
        if result["resource_class"] != plan.resource_class or result["environment"] != plan.environment:
            raise ProvisioningPolicyError("PROVIDER_RESOURCE_SCOPE_MISMATCH")
        if result["currency"] != plan.currency or result["idempotency_key"] != plan.idempotency_key:
            raise ProvisioningPolicyError("PROVIDER_RESOURCE_COST_OR_IDEMPOTENCY_MISMATCH")
        try:
            actual_cost = Decimal(str(result["recurring_cost"]))
            approved_cost = Decimal(str(approval.maximum_cost))
        except (InvalidOperation, ValueError) as exc:
            raise ProvisioningPolicyError("PROVIDER_RECURRING_COST_INVALID") from exc
        if not actual_cost.is_finite() or actual_cost < 0:
            raise ProvisioningPolicyError("PROVIDER_RECURRING_COST_INVALID")
        if actual_cost > approved_cost:
            provider.quarantine(str(result["resource_id"]), "actual recurring cost exceeds approved ceiling")
            raise ProvisioningPolicyError("PROVIDER_COST_EXCEEDS_APPROVED_CEILING")
        return {
            "logical_node_identity": "software-runtime",
            "runtime_host_is_separate": True,
            "execution_environment_id": str(result["resource_id"]),
            "provider_id": plan.provider,
            "environment": plan.environment,
            "status": "PROVISIONED_PENDING_ATTESTATION",
            "promotion_eligible": False,
            "evidence": dict(result),
        }

    def attest_and_promote(
        self,
        provisioned: Mapping[str, Any],
        plan: ProvisioningPlan,
        *,
        now: str,
        verify_evidence: Callable[[Mapping[str, Any]], bool],
    ) -> Mapping[str, Any]:
        """Validate fresh, independently verified runtime evidence before eligibility.

        The verifier must validate the provider/agent evidence cryptographically
        or against an owner-controlled trust source. A provider's boolean claim
        alone is deliberately insufficient.
        """
        if not callable(verify_evidence):
            raise ProvisioningPolicyError("ATTESTATION_VERIFIER_REQUIRED")
        resource_id = provisioned.get("execution_environment_id")
        if (
            provisioned.get("status") != "PROVISIONED_PENDING_ATTESTATION"
            or provisioned.get("promotion_eligible") is not False
            or provisioned.get("provider_id") != plan.provider
            or provisioned.get("environment") != plan.environment
            or not resource_id
        ):
            raise ProvisioningPolicyError("PROVISIONED_RESOURCE_BINDING_INVALID")

        provider = self._registry.resolve(plan.provider)
        evidence = provider.attest(str(resource_id))
        try:
            if not isinstance(evidence, Mapping) or verify_evidence(evidence) is not True:
                raise ProvisioningPolicyError("ATTESTATION_EVIDENCE_UNVERIFIED")
            required = {
                "resource_id", "provider_id", "provider_account_ref", "region",
                "environment", "logical_node_id", "logical_node_type",
                "runtime_agent_identity", "evidence_id", "attested_at",
                "expires_at", "capabilities", "checks",
            }
            if not required.issubset(evidence):
                raise ProvisioningPolicyError("ATTESTATION_EVIDENCE_INCOMPLETE")
            if (
                evidence["resource_id"] != resource_id
                or evidence["provider_id"] != plan.provider
                or evidence["provider_account_ref"] != plan.provider_account_ref
                or evidence["region"] != plan.region
                or evidence["environment"] != plan.environment
                or evidence["logical_node_id"] != "NODE01"
                or evidence["logical_node_type"] != "software-runtime"
                or not isinstance(evidence["runtime_agent_identity"], str)
                or not evidence["runtime_agent_identity"].strip()
                or not isinstance(evidence["evidence_id"], str)
                or not evidence["evidence_id"].strip()
            ):
                raise ProvisioningPolicyError("ATTESTATION_BINDING_MISMATCH")
            observed = datetime.fromisoformat(str(evidence["attested_at"]).replace("Z", "+00:00"))
            expires = datetime.fromisoformat(str(evidence["expires_at"]).replace("Z", "+00:00"))
            current = datetime.fromisoformat(now.replace("Z", "+00:00"))
            if observed.tzinfo is None or expires.tzinfo is None or current.tzinfo is None:
                raise ProvisioningPolicyError("ATTESTATION_TIMEZONE_REQUIRED")
            observed = observed.astimezone(timezone.utc)
            expires = expires.astimezone(timezone.utc)
            current = current.astimezone(timezone.utc)
            if observed > current + timedelta(seconds=60) or observed < current - timedelta(minutes=5) or expires <= current:
                raise ProvisioningPolicyError("ATTESTATION_STALE_OR_EXPIRED")
            capabilities = evidence["capabilities"]
            checks = evidence["checks"]
            if not isinstance(capabilities, (list, tuple, set)) or not set(plan.capabilities).issubset(set(capabilities)):
                raise ProvisioningPolicyError("ATTESTATION_CAPABILITY_MISMATCH")
            required_checks = {
                "agent_identity_verified", "runtime_binding_verified",
                "security_baseline_verified", "heartbeat_verified",
            }
            if not isinstance(checks, (list, tuple, set)) or not required_checks.issubset(set(checks)):
                raise ProvisioningPolicyError("ATTESTATION_REQUIRED_CHECKS_MISSING")
        except Exception as exc:
            provider.quarantine(str(resource_id), f"attestation rejected: {type(exc).__name__}")
            if isinstance(exc, ProvisioningPolicyError):
                raise
            raise ProvisioningPolicyError("ATTESTATION_EVIDENCE_INVALID") from exc

        return {
            **dict(provisioned),
            "status": "ELIGIBLE",
            "promotion_eligible": True,
            "logical_node_id": "NODE01",
            "logical_node_identity": "software-runtime",
            "runtime_host_is_separate": True,
            "attestation": dict(evidence),
        }
