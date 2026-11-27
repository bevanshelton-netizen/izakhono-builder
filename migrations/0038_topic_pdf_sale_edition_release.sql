-- Final sale-edition render metadata is kept separate from editorial proof storage.
-- The publication remains approved, not publicly saleable, until an owner publishes it.

ALTER TABLE topic_pdf_publications ADD COLUMN sale_storage_key TEXT;
ALTER TABLE topic_pdf_publications ADD COLUMN sale_sha256 TEXT;
ALTER TABLE topic_pdf_publications ADD COLUMN sale_bytes INTEGER;
ALTER TABLE topic_pdf_publications ADD COLUMN sale_rendered_at TEXT;
ALTER TABLE topic_pdf_publications ADD COLUMN sale_render_lease_until TEXT;
ALTER TABLE topic_pdf_publications ADD COLUMN sale_render_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topic_pdf_publications ADD COLUMN published_at TEXT;
ALTER TABLE topic_pdf_publications ADD COLUMN published_by TEXT;

CREATE INDEX IF NOT EXISTS idx_topic_pdf_publication_sale_queue
  ON topic_pdf_publications(status, sale_storage_key, sale_render_lease_until, updated_at);
