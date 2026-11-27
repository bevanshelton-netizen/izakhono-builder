-- Customer authentication throttling for the Topic PDF storefront.
CREATE TABLE IF NOT EXISTS topic_pdf_auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topic_pdf_auth_rate_updated
  ON topic_pdf_auth_rate_limits(updated_at);
