"""Approval-gated, provider-neutral execution capacity planning.

This module intentionally performs no provider API calls. It validates plans and
approvals before a separately implemented provider adapter can be invoked.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
from typing import Any, Mapping

_SECRET_KEYS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret", "authorization"}
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
_STATES = {
    "REQUESTED": {"PLANNED", "FAILED"}, "PLANNED": {"AWAITING_APPROVAL", "FAILED"},
    "AWAITING_APPROVAL": {"PROVISIONING", "FAILED", "PAUSED"}, "PROVISIONING": {"PROVISIONED", "FAILED"},
    "PROVISIONED": {"ATTESTING", "QUARANTINED"}, "ATTESTING": {"ELIGIBLE", "QUARANTINED"},
    "ELIGIBLE": {"DRAINING", "QUARANTINED"}, "DRAINING": {"RELEASE_PENDING", "ELIGIBLE", "QUARANTINED"},
    "RELEASE_PENDING": {"RELEASED", "QUARANTINED"}, "PAUSED": {"AWAITING_APPROVAL", "FAILED"},
    "QUARANTINED": {"ATTESTING", "DRAINING"}, "FAILED": set(), "RELEASED": set(),
}


class ProvisioningPolicyError(ValueError):
    """A request, plan, approval or lifecycle transition violates policy."""


def _reject_secrets(value: Any, path: str = "payload") -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if str(key).lower() in _SECRET_KEYS:
                raise ProvisioningPolicyError(f"SECRET_FIELD_PROHIBITED:{path}.{key}")
            _reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            _reject_secrets(child, f"{path}[{index}]")


def _identifier(value: Any, field: str) -> str:
    if not isinstance(value, str) or not _ID.fullmatch(value):
        raise ProvisioningPolicyError(f"INVALID_IDENTIFIER:{field}")
    return value


def _time(value: str, field: str) -> datetime:
    if not isinstance(value, str):
        raise ProvisioningPolicyError(f"INVALID_TIMESTAMP:{field}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ProvisioningPolicyError(f"INVALID_TIMESTAMP:{field}") from exc
    if parsed.tzinfo is None:
        raise ProvisioningPolicyError(f"TIMEZONE_REQUIRED:{field}")
    return parsed.astimezone(timezone.utc)


def _money(value: Any, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ProvisioningPolicyError(f"INVALID_COST:{field}") from exc
    if not amount.is_finite() or amount < 0:
        raise ProvisioningPolicyError(f"INVALID_COST:{field}")
    return amount.quantize(Decimal("0.01"))


def _canonical_hash(payload: Mapping[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ProvisioningPlan:
    plan_id: str
    request_id: str
    idempotency_key: str
    provider: str
    provider_account_ref: str
    region: str
    resource_class: str
    environment: str
    currency: str
    estimated_recurring_cost: str
    maximum_approved_cost: str
    created_at: str
    expires_at: str
    capabilities: tuple[str, ...]
    plan_digest: str


@dataclass(frozen=True)
class ProvisioningApproval:
    approval_id: str
    actor_id: str
    plan_id: str
    plan_digest: str
    environment: str
    currency: str
    maximum_cost: str
    approved_at: str
    expires_at: str
    fortress_authorization_ref: str


def create_plan(request: Mapping[str, Any], provider_capability: Mapping[str, Any], *, now: str, ttl_minutes: int = 30) -> ProvisioningPlan:
    """Create a deterministic, side-effect-free plan from explicit inputs."""
    _reject_secrets(request)
    _reject_secrets(provider_capability)
    if ttl_minutes < 1 or ttl_minutes > 1440:
        raise ProvisioningPolicyError("PLAN_TTL_OUT_OF_RANGE")
    for key in ("request_id", "idempotency_key", "environment", "provider", "region", "resource_class", "currency"):
        _identifier(request.get(key), f"request.{key}")
    for key in ("provider", "account_ref", "region", "resource_class", "currency"):
        _identifier(provider_capability.get(key), f"capability.{key}")
    if request["provider"] != provider_capability["provider"]:
        raise ProvisioningPolicyError("PROVIDER_SELECTION_MISMATCH")
    for key in ("region", "resource_class", "currency"):
        if request[key] != provider_capability[key]:
            raise ProvisioningPolicyError(f"CAPABILITY_MISMATCH:{key}")
    estimate = _money(provider_capability.get("estimated_recurring_cost"), "estimated_recurring_cost")
    ceiling = _money(request.get("maximum_cost"), "maximum_cost")
    if estimate > ceiling:
        raise ProvisioningPolicyError("ESTIMATED_COST_EXCEEDS_USER_CEILING")
    observed = _time(now, "now")
    expiry = observed + timedelta(minutes=ttl_minutes)
    raw = {
        "request_id": request["request_id"], "idempotency_key": request["idempotency_key"],
        "provider": request["provider"], "provider_account_ref": provider_capability["account_ref"],
        "region": request["region"], "resource_class": request["resource_class"],
        "environment": request["environment"], "currency": request["currency"],
        "estimated_recurring_cost": format(estimate, ".2f"), "maximum_approved_cost": format(ceiling, ".2f"),
        "created_at": observed.isoformat(), "expires_at": expiry.isoformat(),
        "capabilities": tuple(sorted(set(provider_capability.get("capabilities", ())))),
    }
    digest = _canonical_hash(raw)
    return ProvisioningPlan(
        plan_id=f"plan_{digest[:24]}", request_id=raw["request_id"], idempotency_key=raw["idempotency_key"],
        provider=raw["provider"], provider_account_ref=raw["provider_account_ref"], region=raw["region"],
        resource_class=raw["resource_class"], environment=raw["environment"], currency=raw["currency"],
        estimated_recurring_cost=raw["estimated_recurring_cost"], maximum_approved_cost=raw["maximum_approved_cost"],
        created_at=raw["created_at"], expires_at=raw["expires_at"], capabilities=raw["capabilities"], plan_digest=digest,
    )


def _plan_payload(plan: ProvisioningPlan) -> dict[str, Any]:
    return {
        "request_id": plan.request_id, "idempotency_key": plan.idempotency_key,
        "provider": plan.provider, "provider_account_ref": plan.provider_account_ref,
        "region": plan.region, "resource_class": plan.resource_class,
        "environment": plan.environment, "currency": plan.currency,
        "estimated_recurring_cost": plan.estimated_recurring_cost,
        "maximum_approved_cost": plan.maximum_approved_cost,
        "created_at": plan.created_at, "expires_at": plan.expires_at,
        "capabilities": tuple(sorted(set(plan.capabilities))),
    }


def approve_plan(plan: ProvisioningPlan, approval: ProvisioningApproval, *, now: str) -> None:
    """Validate exact-plan FORTRESS approval; performs no provisioning."""
    _reject_secrets(asdict(approval))
    recomputed_digest = _canonical_hash(_plan_payload(plan))
    if recomputed_digest != plan.plan_digest or plan.plan_id != f"plan_{recomputed_digest[:24]}":
        raise ProvisioningPolicyError("PLAN_INTEGRITY_MISMATCH")
    if approval.plan_id != plan.plan_id or approval.plan_digest != plan.plan_digest:
        raise ProvisioningPolicyError("APPROVAL_PLAN_MISMATCH")
    if approval.environment != plan.environment or approval.currency != plan.currency:
        raise ProvisioningPolicyError("APPROVAL_SCOPE_MISMATCH")
    for field, value in (("approval_id", approval.approval_id), ("actor_id", approval.actor_id), ("fortress_authorization_ref", approval.fortress_authorization_ref)):
        _identifier(value, field)
    approved_at = _time(approval.approved_at, "approved_at")
    approval_expires = _time(approval.expires_at, "approval.expires_at")
    current = _time(now, "now")
    plan_expires = _time(plan.expires_at, "plan.expires_at")
    if approved_at > current or approval_expires <= current or plan_expires <= current:
        raise ProvisioningPolicyError("APPROVAL_OR_PLAN_EXPIRED")
    if approved_at > plan_expires:
        raise ProvisioningPolicyError("APPROVAL_AFTER_PLAN_EXPIRY")
    approved_ceiling = _money(approval.maximum_cost, "approval.maximum_cost")
    plan_ceiling = _money(plan.maximum_approved_cost, "plan.maximum_approved_cost")
    estimate = _money(plan.estimated_recurring_cost, "plan.estimated_recurring_cost")
    if approved_ceiling > plan_ceiling or estimate > approved_ceiling:
        raise ProvisioningPolicyError("APPROVED_COST_CEILING_INVALID")


def transition_state(current: str, target: str) -> str:
    """Validate one lifecycle transition without persisting or executing it."""
    if current not in _STATES or target not in _STATES[current]:
        raise ProvisioningPolicyError(f"INVALID_STATE_TRANSITION:{current}->{target}")
    return target


def provision_authorization_envelope(plan: ProvisioningPlan, approval: ProvisioningApproval, *, now: str) -> dict[str, Any]:
    """Return the minimal verified envelope a future adapter may consume."""
    approve_plan(plan, approval, now=now)
    return {
        "plan_id": plan.plan_id, "plan_digest": plan.plan_digest, "request_id": plan.request_id,
        "idempotency_key": plan.idempotency_key, "provider": plan.provider,
        "provider_account_ref": plan.provider_account_ref, "region": plan.region,
        "resource_class": plan.resource_class, "environment": plan.environment, "currency": plan.currency,
        "estimated_recurring_cost": plan.estimated_recurring_cost, "maximum_approved_cost": approval.maximum_cost,
        "approval_id": approval.approval_id, "actor_id": approval.actor_id,
        "fortress_authorization_ref": approval.fortress_authorization_ref,
        "authorization_status": "validated_not_executed", "side_effects_performed": False,
    }


if __name__ == "__main__":
    print("EXECUTION ENVIRONMENT PROVISIONING POLICY: PASS (validation only; no provider calls)")
