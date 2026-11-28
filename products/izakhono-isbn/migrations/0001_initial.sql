PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  company_registration TEXT,
  country_code TEXT NOT NULL DEFAULT 'ZA',
  physical_address TEXT,
  postal_address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imprints (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(publisher_id, name)
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  pen_name INTEGER NOT NULL DEFAULT 0 CHECK (pen_name IN (0,1)),
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  imprint_id TEXT REFERENCES imprints(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  language_code TEXT NOT NULL DEFAULT 'en',
  description TEXT,
  subject_codes TEXT,
  publication_status TEXT NOT NULL DEFAULT 'development'
    CHECK (publication_status IN ('development','metadata_ready','in_production','published','withdrawn')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_authors (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES authors(id),
  contributor_role TEXT NOT NULL DEFAULT 'author',
  display_order INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(work_id, author_id, contributor_role)
);

CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  edition_statement TEXT NOT NULL DEFAULT 'First edition',
  format_code TEXT NOT NULL CHECK (format_code IN ('EPUB','PDF','MOBI','PAPERBACK','HARDCOVER','AUDIOBOOK','OTHER')),
  language_code TEXT NOT NULL DEFAULT 'en',
  publication_date TEXT,
  publication_place TEXT,
  publisher_display TEXT,
  page_count INTEGER,
  duration_seconds INTEGER,
  file_master_ref TEXT,
  distribution_channels TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','metadata_ready','submitted_to_agency','isbn_assigned','production_ready','published','withdrawn')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, edition_statement, format_code, language_code)
);

CREATE TABLE IF NOT EXISTS agency_applications (
  id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL DEFAULT 'National Library of South Africa',
  contact_person TEXT,
  contact_email TEXT,
  submitted_at TEXT,
  follow_up_at TEXT,
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged','information_requested','approved','rejected','closed')),
  titles_json TEXT NOT NULL DEFAULT '[]',
  correspondence_notes TEXT,
  evidence_ref TEXT,
  next_action TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS isbn_records (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL UNIQUE REFERENCES editions(id),
  isbn13 TEXT NOT NULL UNIQUE,
  allocation_authority TEXT NOT NULL,
  allocation_date TEXT,
  publisher_of_record TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','evidence_pending','verified','disputed','withdrawn')),
  evidence_ref TEXT,
  barcode_asset_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(replace(replace(isbn13,'-',''),' ','')) = 13)
);

CREATE TABLE IF NOT EXISTS legal_deposit_records (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  jurisdiction TEXT NOT NULL DEFAULT 'ZA',
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  due_date TEXT,
  submitted_at TEXT,
  recipient TEXT,
  proof_ref TEXT,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','prepared','submitted','acknowledged','not_required')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_works_publisher ON works(publisher_id);
CREATE INDEX IF NOT EXISTS idx_editions_work ON editions(work_id);
CREATE INDEX IF NOT EXISTS idx_editions_status ON editions(status);
CREATE INDEX IF NOT EXISTS idx_applications_status ON agency_applications(status);
CREATE INDEX IF NOT EXISTS idx_isbn_status ON isbn_records(verification_status);
