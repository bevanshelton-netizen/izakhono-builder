# Webhook → Entitlement Gate V1

This release establishes the durable-control boundary needed before payment events can influence playback access.

`SIGNED WEBHOOK → VERIFY → DEDUPE → RECORD → ENTITLEMENT → PLAYBACK RECHECK`

The reference verifier is intentionally synthetic. A production implementation must bind the verifier to the provider's documented signing algorithm and raw request body, use durable transactional persistence, and prove replay protection under concurrency.
