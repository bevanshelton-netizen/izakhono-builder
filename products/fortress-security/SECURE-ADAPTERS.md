# FORTRESS v2.3 — Secure Adapter Framework

The adapter layer is a controlled boundary between an approved enforcement decision and any downstream execution adapter.

## Security pipeline

`INTELLIGENCE → POLICY → APPROVAL → ENFORCEMENT → ADAPTER → AUDIT`

## Fail-closed controls

- Only `ALLOW` enforcement decisions may reach an adapter.
- Decision integrity must be structurally valid.
- Tenant, action, and target must exactly match the enforcement context.
- Unsupported actions have no adapter and are denied.
- Adapter registration is explicit; duplicate names are rejected.
- Adapters return tenant- and decision-bound results.
- The framework does not dynamically load code or perform external side effects.

## Production boundary

The supplied safe adapter is a no-op reference implementation. Real adapters must be separately authorized, audited, rate-limited, tenant-isolated, and reviewed before integration with any external system.
