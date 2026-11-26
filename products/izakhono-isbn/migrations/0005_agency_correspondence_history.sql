-- Durable, append-only history of publisher-to-agency correspondence.
CREATE TABLE IF NOT EXISTS agency_correspondence (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES agency_applications(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  occurred_at TEXT NOT NULL,
  recipient TEXT,
  cc TEXT,
  subject TEXT,
  evidence_ref TEXT,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agency_correspondence_application
  ON agency_correspondence(application_id, occurred_at);

INSERT OR IGNORE INTO agency_correspondence (
  id, application_id, direction, occurred_at, recipient, subject, evidence_ref, summary
) VALUES
(
  'correspondence-nlsa-initial-2026-10-06',
  'application-nlsa-business-of-music-2026',
  'outgoing', '2026-10-06',
  'National Library of South Africa',
  'ISBN application: THE BUSINESS OF MUSIC™ (EPUB)',
  'gmail-thread:1a1125845cddacf7',
  'Initial ISBN application and publisher registration request submitted for THE BUSINESS OF MUSIC™ EPUB.'
),
(
  'correspondence-nlsa-followup-2026-10-14',
  'application-nlsa-business-of-music-2026',
  'outgoing', '2026-10-14',
  'National Library of South Africa',
  'Follow-up: ISBN application for THE BUSINESS OF MUSIC™ (EPUB)',
  NULL,
  'Follow-up sent requesting acknowledgement and progress on the outstanding application.'
),
(
  'correspondence-nlsa-escalation-2026-11-26',
  'application-nlsa-business-of-music-2026',
  'outgoing', '2026-11-26',
  'info@nlsa.ac.za',
  'Escalation: Outstanding ISBN application and publisher registration – IZAKHONO AFRICA (PTY) LTD',
  NULL,
  'Escalation sent; Motubatse.Kgatle@nlsa.ac.za copied. Requested acknowledgement and status, commercial publisher registration, SELFHELP Stories imprint recognition, ISBN allocation process, metadata/legal-deposit instructions, and a named contact/reference. No reply or ISBN allocation is yet verified.'
);
