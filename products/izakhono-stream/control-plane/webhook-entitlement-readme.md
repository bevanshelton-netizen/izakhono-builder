# Payment Webhook → Entitlement

Reference implementation for IZAKHONO STREAM. The flow verifies provider events, prevents replay, maps payment state to tenant-scoped entitlement state, and leaves playback to perform its own current authorization checks.

Production credentials, provider cryptography, durable persistence, reconciliation, and sandbox evidence are separate release gates.
