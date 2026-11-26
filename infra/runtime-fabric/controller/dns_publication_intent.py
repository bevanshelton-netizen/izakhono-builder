#!/usr/bin/env python3
"""Create durable, authorized DNS publication intents in Runtime Fabric.

This module queues intent only. It never invokes NODE01, HOST, PowerDNS, a
registrar, or any public DNS provider.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol

from deployment_state import DeploymentRecord
from observability import RuntimeEvent


@dataclass(frozen=True)
class DnsPublicationAuthorization:
    allowed: bool
    authorization_id: str | None
    audit_event_id: str
    reason: str


@dataclass(frozen=True)
class DnsPublicationRequest:
    tenant_id: str
    zone_id: str
    zone_name: str
    desired_serial: int
    approval_id: str
    environment: str = "production"


@dataclass(frozen=True)
class DnsPublicationIntentResult:
    deployment_id: str
    workload: str
    state: str
    event_id: str
    publication: str = "not-published"


class DeploymentStore(Protocol):
    def get(self, deployment_id: str) -> DeploymentRecord | None: ...
    def put(self, record: DeploymentRecord) -> DeploymentRecord: ...


class RuntimeEventStore(Protocol):
    def append(self, event: RuntimeEvent, event_id: str | None = None) -> str: ...


def _validate(request: DnsPublicationRequest, authorization: DnsPublicationAuthorization) -> None:
    if authorization.allowed is not True:
        raise PermissionError("FORTRESS denied DNS publication; no intent was created")
    if not authorization.authorization_id or not authorization.audit_event_id:
        raise PermissionError("FORTRESS authorization and audit acknowledgement are required")
    if not request.tenant_id.strip() or not request.zone_id.strip() or not request.approval_id.strip():
        raise ValueError("tenant, zone and approval identifiers are required")
    zone = request.zone_name.strip().lower().removesuffix(".")
    if len(zone) > 253 or not zone or not all(
        label and len(label) <= 63 and label[0].isalnum() and label[-1].isalnum()
        and all(char.isalnum() or char == "-" for char in label)
        for label in zone.split(".")
    ):
        raise ValueError("valid DNS zone name is required")
    if not isinstance(request.desired_serial, int) or request.desired_serial < 1:
        raise ValueError("positive desired SOA serial is required")
    if request.environment != "production":
        raise ValueError("DNS publication intent must explicitly target production")


def create_dns_publication_intent(
    request: DnsPublicationRequest,
    authorization: DnsPublicationAuthorization,
    deployments: DeploymentStore,
    events: RuntimeEventStore,
) -> DnsPublicationIntentResult:
    """Persist an idempotent PLANNED intent after FORTRESS authorization."""
    _validate(request, authorization)
    workload = "izakhono-edge"
    scope = "|".join((
        request.tenant_id,
        request.zone_id,
        request.zone_name.strip().lower().removesuffix("."),
        str(request.desired_serial),
        authorization.authorization_id,
    ))
    digest = hashlib.sha256(scope.encode("utf-8")).hexdigest()
    deployment_id = f"dns-{digest[:40]}"
    event_id = f"dns-intent-{digest[:40]}"

    metadata = {
        "kind": "dns-publication",
        "tenant_id": request.tenant_id,
        "zone_id": request.zone_id,
        "zone_name": request.zone_name.strip().lower().removesuffix("."),
        "desired_serial": str(request.desired_serial),
        "approval_id": authorization.authorization_id,
        "fortress_audit_event_id": authorization.audit_event_id,
        "environment": request.environment,
        "publication": "not-published",
    }
    existing = deployments.get(deployment_id)
    if existing is not None:
        if existing.workload != workload or existing.metadata != metadata:
            raise ValueError("DNS deployment identity is already bound to different intent metadata")
        record = existing
    else:
        record = deployments.put(DeploymentRecord(
            deployment_id=deployment_id,
            workload=workload,
            state="CREATED",
            metadata=metadata,
        ))

    event = RuntimeEvent.create(
        deployment_id,
        workload,
        "dns_publication_intent",
        record.state,
        None,
        f"authorized DNS publication intent recorded for zone {metadata['zone_name']} serial {request.desired_serial}; publication remains disabled",
        evidence=False,
    )
    stored_event_id = events.append(event, event_id=event_id)
    return DnsPublicationIntentResult(
        deployment_id=deployment_id,
        workload=workload,
        state=record.state,
        event_id=stored_event_id,
    )
