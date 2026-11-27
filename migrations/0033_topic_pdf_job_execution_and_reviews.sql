-- Durable execution and editorial review fields for Topic PDF jobs.
-- Existing records remain safe: no job is automatically approved or published.

ALTER TABLE topic_pdf_generation_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN next_attempt_at TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN lease_until TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN last_error TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN manuscript_json TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN research_json TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN reviewer_name TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN reviewer_role TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_topic_pdf_jobs_queue
  ON topic_pdf_generation_jobs(status, next_attempt_at, lease_until, created_at);

CREATE TABLE IF NOT EXISTS topic_pdf_review_decisions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES topic_pdf_generation_jobs(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('changes_required','approved','rejected')),
  rights_reviewed INTEGER NOT NULL CHECK (rights_reviewed IN (0,1)),
  factual_review_passed INTEGER NOT NULL CHECK (factual_review_passed IN (0,1)),
  specialist_review_passed INTEGER NOT NULL CHECK (specialist_review_passed IN (0,1)),
  editorial_approved INTEGER NOT NULL CHECK (editorial_approved IN (0,1)),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_review_job_created
  ON topic_pdf_review_decisions(job_id, created_at);
