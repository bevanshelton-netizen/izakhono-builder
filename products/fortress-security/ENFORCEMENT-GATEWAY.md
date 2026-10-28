# FORTRESS v2.2 — Enforcement Gateway

The enforcement gateway is the final defensive authorization checkpoint before a downstream execution adapter may perform an approved action.

## Fail-closed rules

1. Tenant, actor, action, target and policy context are mandatory.
2. Approval must explicitly be `APPROVED`.
3. An approval identifier is mandatory.
4. Expired approvals are denied.
5. Missing or ambiguous authorization is denied.
6. The gateway produces a deterministic decision identifier and SHA-256 integrity value.

The gateway does not itself execute network, remediation, administrative, or offensive actions. Downstream adapters remain separate and must validate the gateway decision, enforce their own authorization boundaries, rate limits and audit requirements.
