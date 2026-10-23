ALTER TABLE pay_provider_routes ADD COLUMN environment TEXT NOT NULL DEFAULT 'sandbox';

CREATE INDEX IF NOT EXISTS idx_pay_routes_environment_lookup
ON pay_provider_routes(environment, country, currency, payment_method, enabled, priority);

UPDATE pay_provider_routes
SET environment='sandbox'
WHERE provider='izakhono_sandbox';
