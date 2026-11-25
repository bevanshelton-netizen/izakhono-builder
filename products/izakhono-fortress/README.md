# IZAKHONO FORTRESS

FORTRESS is the sovereign security and authorisation boundary for the IZAKHONO group stack.

## Operating rule

**Inside IZAKHONO:** owner-controlled services are the default.

**Outside IZAKHONO:** external providers may be used deliberately for approved advisory, research and other non-core work. They never become identity, entitlement, payment, ledger, secret-storage or core-runtime authorities.

## Default-deny policy

The policy is defined in `policy.json`. Every decision validates the complete policy document before evaluation. Invalid versions, non-deny defaults, malformed product maps, wildcard identities or permissions, duplicate grants and malformed permission identifiers invalidate the policy. A policy load or validation failure produces no authorisation.

Product permissions require an exact match across:
- Subject.
- Entity ID.
- Role.
- Product.
- Permission.

There is no wildcard matching and no implicit role inheritance. The initial EXPERIENCE grant list is empty. No identity is authorised by default.

Permission identifiers use a constrained form such as `experience:survey:read`, `experience:survey:write` or `experience:case:resolve`.

## Policy administration

Policy changes are owner-controlled source changes, reviewed and tested through the repository workflow. A grant must identify the exact subject, entity, role, product and minimal permission set. Changes must include a policy version increment, rationale and review evidence. Never add broad wildcard grants or use a service credential as a policy-administration credential.

The decision service intentionally exposes no remote grant/revoke API. This prevents a product service credential from becoming a privilege-escalation mechanism. A dedicated owner administration interface requires a separate identity, approval and audit design before it can be built.

## Policy decision service

`guard.py` provides:
- `GET /healthz` — non-sensitive liveness response.
- `GET /v1/policy` — authenticated policy metadata.
- `POST /v1/authorize-egress` — default-deny external egress decision.
- `POST /v1/authorize-product` — default-deny product permission decision.

All policy and authorisation calls require `IZAKHONO_FORTRESS_TOKEN`. The service binds to `127.0.0.1` by default. It is not a public endpoint. Cross-service access requires an approved private, authenticated transport and separate service credentials. Do not expose the listener directly to the internet.

This is a policy decision point, not yet a transparent network firewall. Products must route declared external egress through this decision before a future FORTRESS network enforcement layer can guarantee operating-system-level blocking.

## Audit and failure behaviour

Each decision emits a structured log event with a unique decision ID, route, allow/deny result, reason and timestamp. Do not log bearer tokens, secrets or raw request payloads. The caller must preserve decision IDs in its own protected audit trail.

Malformed requests are rejected. Invalid policy, unavailable policy files, unexpected exceptions, expired identity sessions and untraceable decisions must fail closed. Decision logs currently use the service logging stream; durable central audit retention and tamper-evident storage remain future infrastructure work.

## Data handling

External AI is advisory only. FORTRESS blocks credentials, raw auth tokens, private keys, payment-card data, banking credentials, sensitive personal information, customer-private data and database dumps from external AI egress.

POPIA-aware controls, retention, access, correction and deletion workflows must be implemented and assessed for each product before production activation. No certification claim is implied.
