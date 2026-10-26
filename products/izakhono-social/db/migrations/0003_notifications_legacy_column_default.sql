-- CONNECTA notification compatibility hardening.
-- The current engine writes the canonical `kind` field and omits the
-- legacy `notification_type` field. Keep the legacy column required while
-- supplying a safe default for engine inserts.

alter table notifications
  alter column notification_type set default 'general';
