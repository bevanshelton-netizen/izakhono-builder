# Webhook → Entitlement Summary V1

This branch establishes the reference payment-to-entitlement boundary for IZAKHONO STREAM and KORA NETWORK.

Flow: verify provider webhook → deduplicate durable event key → translate payment status → upsert tenant-scoped entitlement → require playback revalidation.

No live payment credentials, production provider verification, or production entitlement database is introduced here.
