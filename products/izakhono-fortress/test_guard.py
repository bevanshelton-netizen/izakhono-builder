#!/usr/bin/env python3
import importlib.util
from copy import deepcopy
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fortress", here / "guard.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p = m.load_policy()


def check(req, expected, reason=None):
    ok, why = m.authorize(req, p)
    assert ok is expected, (req, ok, why)
    if reason:
        assert why == reason, (why, reason)


check({
    "entity_id": "allegro-vibez", "provider_class": "external_ai",
    "purpose": "research", "data_class": "public", "payload": {"topic": "radio trends"}
}, True)
check({
    "entity_id": "allegro-vibez", "provider_class": "external_ai",
    "purpose": "sanitized_debugging", "data_class": "internal_sanitized",
    "payload": {"error": "timeout", "component": "stream"}
}, True)
check({
    "entity_id": "allegro-vibez", "provider_class": "external_ai",
    "purpose": "core_runtime_inference_dependency", "data_class": "non_sensitive",
    "payload": {"text": "hello"}
}, False, "forbidden_external_ai_purpose")
check({
    "entity_id": "izakhono-pay", "provider_class": "external_ai",
    "purpose": "research", "data_class": "credentials", "payload": {"topic": "payments"}
}, False, "forbidden_data_class")
check({
    "entity_id": "izakhono-pay", "provider_class": "external_ai",
    "purpose": "advisory", "data_class": "internal_sanitized", "payload": {"api_key": "abc123"}
}, False, "secret_like_field_detected")
check({
    "provider_class": "external_ai", "purpose": "research",
    "data_class": "public", "payload": {"topic": "x"}
}, False, "entity_scope_required")


def product_request(**overrides):
    request = {
        "subject": "member-17",
        "entity_id": "entity-izakhono",
        "role": "experience-manager",
        "product": "izakhono-experience",
        "permission": "experience:survey:read"
    }
    request.update(overrides)
    return request


def test_product_permissions():
    # Empty product policy denies all callers.
    assert m.authorize_product(product_request(), p) == (False, "product_permission_not_allowlisted")

    configured = deepcopy(p)
    configured["product_permissions"]["izakhono-experience"] = [{
        "subject": "member-17",
        "entity_id": "entity-izakhono",
        "role": "experience-manager",
        "permissions": ["experience:survey:read", "experience:survey:write"]
    }]
    assert m.authorize_product(product_request(), configured) == (True, "explicit_product_permission_granted")
    assert m.authorize_product(product_request(permission="experience:case:resolve"), configured)[0] is False
    assert m.authorize_product(product_request(subject="other-member"), configured)[0] is False
    assert m.authorize_product(product_request(entity_id="other-entity"), configured)[0] is False
    assert m.authorize_product(product_request(role="administrator"), configured)[0] is False
    assert m.authorize_product(product_request(product="unknown-product"), configured)[0] is False
    assert m.authorize_product({"entity_id": "x"}, configured)[0] is False


test_product_permissions()
print("IZAKHONO_FORTRESS_POLICY=PASS")


# Policy documents are validated before either egress or product authorisation.
def test_policy_integrity():
    unsafe = []
    candidate = deepcopy(p)
    candidate["default"] = "allow"
    unsafe.append(candidate)

    candidate = deepcopy(p)
    candidate["product_permissions"]["izakhono-experience"] = [{
        "subject": "*", "entity_id": "entity-izakhono", "role": "experience-manager",
        "permissions": ["experience:survey:read"]
    }]
    unsafe.append(candidate)

    candidate = deepcopy(p)
    candidate["product_permissions"]["izakhono-experience"] = [{
        "subject": "member-17", "entity_id": "entity-izakhono", "role": "experience-manager",
        "permissions": ["*"]
    }]
    unsafe.append(candidate)

    candidate = deepcopy(p)
    candidate["product_permissions"]["izakhono-experience"] = [
        {"subject": "member-17", "entity_id": "entity-izakhono", "role": "experience-manager",
         "permissions": ["experience:survey:read"]},
        {"subject": "member-17", "entity_id": "entity-izakhono", "role": "experience-manager",
         "permissions": ["experience:survey:write"]}
    ]
    unsafe.append(candidate)

    candidate = deepcopy(p)
    candidate["version"] = True
    unsafe.append(candidate)

    for policy in unsafe:
        try:
            m.validate_policy(policy)
        except ValueError:
            continue
        raise AssertionError("unsafe_policy_was_accepted")

    malformed = deepcopy(p)
    malformed["product_permissions"]["izakhono-experience"] = "allow-all"
    try:
        m.authorize_product(product_request(), malformed)
    except ValueError:
        pass
    else:
        raise AssertionError("malformed_policy_did_not_fail_closed")


test_policy_integrity()
print("IZAKHONO_FORTRESS_POLICY_INTEGRITY=PASS")
