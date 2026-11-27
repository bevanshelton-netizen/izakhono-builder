-- Strengthen request idempotency and record independent specialist credentials.
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_pdf_jobs_customer_idempotency
  ON topic_pdf_generation_jobs(requested_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE topic_pdf_review_decisions ADD COLUMN specialist_reviewer_name TEXT;
ALTER TABLE topic_pdf_review_decisions ADD COLUMN specialist_credentials TEXT;
ALTER TABLE topic_pdf_review_decisions ADD COLUMN specialist_reviewed_at TEXT;
