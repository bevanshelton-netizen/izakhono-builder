# iKhokha Sandbox Gate Control

This gate is intentionally provider-specific and remains non-production until real sandbox evidence is captured.

Required sequence:

1. Verify provider authenticity.
2. Normalize event.
3. Deduplicate event transactionally.
4. Persist entitlement transactionally.
5. Record audit evidence.
6. Revalidate entitlement during playback.
7. Reconcile provider and internal records.
