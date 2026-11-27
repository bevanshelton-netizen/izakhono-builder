-- On-demand Topic PDF generation jobs and auditable review gates.
-- D1 migration: all public-facing access must be mediated by authenticated,
-- rate-limited application routes. Do not expose these tables directly.

CREATE TABLE IF NOT EXISTS topic_pdf_generation_jobs (
  id TEXT PRIMARY KEY,
  request_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'requested','scoping','research_required','drafting','quality_review',
    'specialist_review','ready_for_editor','approved','rendering',
    'delivered','blocked','failed'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('standard','elevated','high')),
  requested_by TEXT,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_jobs_status_created
  ON topic_pdf_generation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_jobs_fingerprint
  ON topic_pdf_generation_jobs(request_fingerprint);

CREATE TABLE IF NOT EXISTS topic_pdf_generation_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES topic_pdf_generation_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_events_job_created
  ON topic_pdf_generation_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS topic_pdf_publications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES topic_pdf_generation_jobs(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  geography TEXT NOT NULL,
  version TEXT NOT NULL,
  storage_key TEXT,
  price_target_usd INTEGER NOT NULL DEFAULT 7 CHECK (price_target_usd = 7),
  status TEXT NOT NULL CHECK (status IN ('editorial_draft','approved','published','withdrawn')),
  rights_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (rights_reviewed IN (0,1)),
  factual_review_passed INTEGER NOT NULL DEFAULT 0 CHECK (factual_review_passed IN (0,1)),
  specialist_review_passed INTEGER NOT NULL DEFAULT 0 CHECK (specialist_review_passed IN (0,1)),
  editorial_approved INTEGER NOT NULL DEFAULT 0 CHECK (editorial_approved IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_publications_status
  ON topic_pdf_publications(status, created_at);
