# IZAKHONO FORTRESS

FORTRESS is the sovereign security boundary for the IZAKHONO group stack.

## Operating rule

**Inside IZAKHONO:** owner-controlled services are the default.

**Outside IZAKHONO:** external providers, including OpenAI, may be used deliberately for advisory, research, public-content generation, sanitized debugging and similar non-core work.

External providers must never become the authority for:

- identity
- entitlements
- payments
- ledgers
- secrets
- customer systems of record
- core runtime availability

## External AI rule

OpenAI or another external AI provider is allowed only as an **optional external capability**.

The current allowed classes are:
- public information
- non-sensitive information
- intentionally sanitized internal information

FORTRESS denies:
- passwords and credentials
- API keys and private keys
- raw auth/session tokens
- payment-card data
- banking credentials
- personal sensitive/customer-private data
- database dumps
- private source secrets
- any attempt to make an external AI provider a required core runtime dependency

## Entity boundary

Every outbound authorization request must carry an `entity_id`. FORTRESS does not permit one entity's data to become another entity's implicit context.

## Default deny

The policy is default-deny. Unknown provider classes, unknown purposes and unknown data classes are blocked.

## Policy decision service

`guard.py` provides a localhost-only authorization endpoint:

- `GET /healthz`
- `GET /v1/policy`
- `POST /v1/authorize-egress`

The service requires `IZAKHONO_FORTRESS_TOKEN` for policy and authorization calls.

This first release is a **policy decision point**, not yet a transparent network firewall. Products must route declared external egress through this decision before a future FORTRESS network enforcement layer can guarantee operating-system-level blocking.

## OpenAI relationship

The policy is intentionally not "never use OpenAI."

It is:

> IZAKHONO remains sovereign and protected. OpenAI may be used outside the sovereign core when it is useful, deliberate, sanitized where needed, and never required for IZAKHONO to keep operating.
