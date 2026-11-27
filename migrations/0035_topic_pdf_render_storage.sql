-- Private PDF render and object-storage result metadata.
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN pdf_storage_key TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN pdf_sha256 TEXT;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN pdf_bytes INTEGER;
ALTER TABLE topic_pdf_generation_jobs ADD COLUMN render_attempt_count INTEGER NOT NULL DEFAULT 0;
