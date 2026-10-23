# IZAKHONO Provisioner Adapter Contract

The Provisioner owns workflow state, policy, idempotency, retries, audit events, evidence gates and handover. Adapters own provider-specific execution only.

## Rules

1. **Owned-first:** select an IZAKHONO-owned adapter whenever its capability is available.
2. **Provider-neutral:** the workflow must never depend on a provider SDK, hostname, API shape or credential format.
3. **Reversible:** external adapters are replaceable without changing tenant workflow state or customer-facing contracts.
4. **Idempotent:** every mutating operation receives an operation ID/idempotency key and must safely tolerate retries.
5. **Fail closed:** an adapter may not report success without evidence that the requested state was actually achieved.
6. **Secret-safe:** credentials and tokens never appear in workflow state, audit events, errors or handover records.
7. **Evidence-first:** adapter results must identify the evidence required by the Acceptance Engine.
8. **No false LIVE:** adapters never transition a tenant to LIVE; only the Acceptance Engine may do so after all gates pass.

## Capability set

- `payment`
- `domain`
- `dns`
- `site`
- `tls`
- `mail`
- `crm_whatsapp`
- `forms`
- `payment_links`
- `acceptance`

## Adapter lifecycle

`DISCOVER → PLAN → EXECUTE → VERIFY → RETURN_EVIDENCE`

An adapter should be deterministic for the same operation ID and desired state. Provider-specific failures are normalized into stable Provisioner error classes so workflow logic remains provider-independent.
