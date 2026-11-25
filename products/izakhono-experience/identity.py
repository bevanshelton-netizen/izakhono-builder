"""Fail-closed bridge from IZAKHONO ID sessions to EXPERIENCE permissions.

The ID service authenticates the bearer session and supplies entity membership.
A separate FORTRESS policy decision must approve each requested permission.
Client-supplied entity IDs, roles and subjects are never accepted as authority.
"""
import json
import os
from datetime import datetime, timezone
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

from domain import ExperienceError, ExperienceStore


class IdentityBoundaryError(ExperienceError):
    pass


def _parse_expiry(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed
    except (TypeError, ValueError):
        return None


class IdentityIntrospectionClient:
    """Service-to-service client for IZAKHONO ID internal introspection."""

    def __init__(self, *, base_url=None, internal_key=None, timeout=3):
        self.base_url = (base_url or os.getenv("IZAKHONO_ID_INTERNAL_URL", "")).rstrip("/")
        self.internal_key = internal_key or os.getenv("IZAKHONO_ID_INTERNAL_KEY", "")
        self.timeout = timeout

    def __call__(self, bearer_token):
        if not self.base_url.startswith("https://") or not self.internal_key or not bearer_token:
            raise IdentityBoundaryError("identity_introspection_not_configured")
        payload = json.dumps({"token": bearer_token}).encode()
        request = Request(
            self.base_url + "/api/v1/internal/introspect",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.internal_key,
                "Cache-Control": "no-store",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                if response.status != 200:
                    raise IdentityBoundaryError("identity_introspection_failed")
                result = json.loads(response.read(65536))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            raise IdentityBoundaryError("identity_introspection_unavailable") from exc
        if not isinstance(result, dict):
            raise IdentityBoundaryError("invalid_identity_response")
        return result


def authorised_experience_store(
    database,
    *,
    bearer_token,
    permission,
    introspect,
    fortress_decide,
):
    """Return a scoped store only after ID authentication and FORTRESS approval.

    Both callables are mandatory. The policy callback must return literal True;
    missing, malformed, unavailable or indeterminate decisions deny access.
    """
    if not isinstance(bearer_token, str) or not bearer_token.strip():
        raise IdentityBoundaryError("bearer_session_required")
    if not isinstance(permission, str) or not permission.strip():
        raise IdentityBoundaryError("experience_permission_required")
    if not callable(introspect) or not callable(fortress_decide):
        raise IdentityBoundaryError("identity_and_fortress_adapters_required")

    try:
        claims = introspect(bearer_token)
    except Exception as exc:
        raise IdentityBoundaryError("identity_introspection_denied") from exc

    if not isinstance(claims, dict) or claims.get("ok") is not True or claims.get("active") is not True:
        raise IdentityBoundaryError("active_identity_session_required")

    subject = claims.get("subject")
    entity_id = claims.get("entity_id")
    role = claims.get("role")
    expiry = _parse_expiry(claims.get("expires_at"))
    if not all(isinstance(x, str) and x.strip() for x in (subject, entity_id, role)):
        raise IdentityBoundaryError("identity_scope_incomplete")
    if expiry is None or expiry <= datetime.now(timezone.utc):
        raise IdentityBoundaryError("identity_session_expired_or_unverifiable")

    decision_input = {
        "subject": subject,
        "entity_id": entity_id,
        "role": role,
        "permission": permission,
        "resource": "izakhono-experience",
    }
    try:
        decision = fortress_decide(decision_input)
    except Exception as exc:
        raise IdentityBoundaryError("fortress_policy_unavailable") from exc
    if decision is not True:
        raise IdentityBoundaryError("fortress_permission_denied")

    # Entity scope comes only from the successfully introspected ID session.
    # The platform identifier is a fixed service scope, not a request parameter.
    return ExperienceStore(database, entity_id=entity_id, platform_id="izakhono-experience"), {
        "subject": subject,
        "entity_id": entity_id,
        "role": role,
        "permission": permission,
    }
