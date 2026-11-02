# Webhook → Entitlement Pipeline V1

`SIGNED WEBHOOK → VERIFY → DEDUPE → TRANSLATE → UPSERT → PLAYBACK RECHECK`

The reference pipeline keeps provider verification and replay protection ahead of entitlement mutation. `PAID` creates an active entitlement; `REFUNDED`, `CANCELLED`, and `FAILED` revoke it. Playback must still revalidate entitlement, rights and device policy at request time.

Production remains gated on provider-specific cryptographic verification, atomic durable persistence, unique replay constraints, retries/dead letters, reconciliation, audit retention, tenant isolation, and sandbox end-to-end evidence.
