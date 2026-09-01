PRAGMA foreign_keys = ON;

ALTER TABLE merchant_apps ADD COLUMN return_origin TEXT;
ALTER TABLE payment_intents ADD COLUMN return_url TEXT;
ALTER TABLE payment_intents ADD COLUMN cancel_url TEXT;
