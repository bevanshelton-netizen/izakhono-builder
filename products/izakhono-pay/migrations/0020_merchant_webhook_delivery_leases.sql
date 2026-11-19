-- Recover webhook deliveries when a Worker exits after claiming a delivery.
-- The lease token fences stale workers from overwriting a later retry.
ALTER TABLE merchant_webhook_deliveries ADD COLUMN lease_token TEXT;
ALTER TABLE merchant_webhook_deliveries ADD COLUMN lease_expires_at TEXT;
