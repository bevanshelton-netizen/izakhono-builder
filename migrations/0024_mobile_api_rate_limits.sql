-- Mobile Intelligence API request throttling, stored in the Builder's primary D1 database.
CREATE TABLE IF NOT EXISTS mobile_api_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_api_rate_limits_updated
  ON mobile_api_rate_limits(updated_at);
