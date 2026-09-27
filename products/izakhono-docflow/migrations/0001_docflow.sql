PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS docflow_templates (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  schema_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docflow_drafts (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  party_a TEXT NOT NULL DEFAULT '',
  party_b TEXT NOT NULL DEFAULT '',
  effective_date TEXT NOT NULL DEFAULT '',
  jurisdiction TEXT NOT NULL DEFAULT '',
  known_fields_json TEXT NOT NULL DEFAULT '{}',
  content_markdown TEXT NOT NULL DEFAULT '',
  ai_status TEXT NOT NULL DEFAULT 'not_requested',
  status TEXT NOT NULL DEFAULT 'review',
  created_by TEXT NOT NULL DEFAULT 'owner',
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TEXT,
  send_status TEXT NOT NULL DEFAULT 'not_queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docflow_approvals (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  approver TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES docflow_drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docflow_audit_events (
  id TEXT PRIMARY KEY,
  draft_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES docflow_drafts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_docflow_drafts_status ON docflow_drafts(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_docflow_audit_draft ON docflow_audit_events(draft_id, created_at);

INSERT OR IGNORE INTO docflow_templates(id, document_type, label, description, schema_json) VALUES
('tpl_nda','nda','Non-Disclosure Agreement','Mutual or one-way confidentiality agreement with human approval required before use.','{"required":["party_a","party_b","effective_date","jurisdiction"]}'),
('tpl_proposal','proposal','Business Proposal','Commercial proposal with scope, assumptions, pricing placeholders and acceptance section.','{"required":["party_a","party_b"]}'),
('tpl_quotation','quotation','Quotation','Structured quotation with line items, validity period and payment terms.','{"required":["party_a","party_b"]}'),
('tpl_sla','sla','Service Level Agreement','Service scope, responsibilities, service levels, escalation and review terms.','{"required":["party_a","party_b","effective_date"]}'),
('tpl_employment','employment_letter','Employment Letter','Employment offer or employment-related letter draft requiring HR/legal review.','{"required":["party_a","party_b","effective_date","jurisdiction"]}'),
('tpl_supplier','supplier_agreement','Supplier Agreement','Supplier terms, deliverables, pricing, quality and dispute placeholders.','{"required":["party_a","party_b","effective_date","jurisdiction"]}');
