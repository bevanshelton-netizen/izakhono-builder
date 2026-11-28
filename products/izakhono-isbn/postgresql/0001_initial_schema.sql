-- IZAKHONO ISBN Registry — PostgreSQL baseline schema.
-- Provider-neutral target schema. Apply with a migration runner; never apply to production
-- until an authorised operator has approved the environment, cost and backup plan.

CREATE TABLE publishers (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  company_registration TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'ZA',
  physical_address TEXT,
  postal_address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE imprints (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES publishers(id),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publisher_id, name)
);

CREATE TABLE authors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  pen_name BOOLEAN NOT NULL DEFAULT FALSE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE works (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_authors (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES authors(id),
  contributor_role TEXT NOT NULL DEFAULT 'author',
  display_order INTEGER NOT NULL DEFAULT 1 CHECK (display_order BETWEEN 1 AND 1000),
  PRIMARY KEY (work_id, author_id, contributor_role)
);

CREATE TABLE editions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  edition_statement TEXT NOT NULL DEFAULT 'First edition',
  format_code TEXT NOT NULL CHECK (format_code IN ('EPUB','PDF','MOBI','PAPERBACK','HARDCOVER','AUDIOBOOK','OTHER')),
  language_code TEXT NOT NULL DEFAULT 'en',
  publication_date DATE,
  publication_place TEXT,
  publisher_display TEXT,
  page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  file_master_ref TEXT,
  distribution_channels TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','metadata_ready','submitted_to_agency','isbn_assigned','production_ready','published','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, edition_statement, format_code, language_code)
);

CREATE TABLE agency_applications (
  id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL DEFAULT 'National Library of South Africa',
  contact_person TEXT,
  contact_email TEXT,
  submitted_at DATE,
  follow_up_at DATE,
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged','information_requested','approved','rejected','closed')),
  titles_json TEXT NOT NULL DEFAULT '[]',
  correspondence_notes TEXT,
  evidence_ref TEXT,
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE isbn_records (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL UNIQUE REFERENCES editions(id),
  isbn13 CHAR(13) NOT NULL UNIQUE,
  allocation_authority TEXT NOT NULL CHECK (length(btrim(allocation_authority)) > 0),
  allocation_date DATE,
  publisher_of_record TEXT NOT NULL CHECK (length(btrim(publisher_of_record)) > 0),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','evidence_pending','verified','disputed','withdrawn')),
  evidence_ref TEXT NOT NULL CHECK (length(btrim(evidence_ref)) > 0),
  barcode_asset_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (isbn13 ~ '^97[89][0-9]{10}$')
);

CREATE FUNCTION izakhono_isbn13_valid(value TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  total INTEGER := 0;
  i INTEGER;
BEGIN
  IF value !~ '^97[89][0-9]{10}$' THEN RETURN FALSE; END IF;
  FOR i IN 1..12 LOOP
    total := total + substring(value FROM i FOR 1)::INTEGER * CASE WHEN i % 2 = 0 THEN 3 ELSE 1 END;
  END LOOP;
  RETURN ((10 - (total % 10)) % 10) = substring(value FROM 13 FOR 1)::INTEGER;
END;
$$;

CREATE FUNCTION izakhono_guard_isbn_record() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT izakhono_isbn13_valid(NEW.isbn13::TEXT) THEN
    RAISE EXCEPTION 'isbn13_checksum_invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.verification_status = 'verified' AND NEW.allocation_date IS NULL THEN
    RAISE EXCEPTION 'verified_isbn_requires_allocation_date' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_isbn_integrity
BEFORE INSERT OR UPDATE OF isbn13, allocation_authority, allocation_date, publisher_of_record, verification_status, evidence_ref
ON isbn_records FOR EACH ROW EXECUTE FUNCTION izakhono_guard_isbn_record();

CREATE TABLE legal_deposit_records (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  jurisdiction CHAR(2) NOT NULL DEFAULT 'ZA',
  required BOOLEAN NOT NULL DEFAULT TRUE,
  due_date DATE,
  submitted_at DATE,
  recipient TEXT,
  proof_ref TEXT,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','prepared','submitted','acknowledged','not_required')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agency_correspondence (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES agency_applications(id),
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  occurred_at TIMESTAMPTZ NOT NULL,
  recipient TEXT,
  cc TEXT,
  subject TEXT,
  evidence_ref TEXT,
  summary TEXT NOT NULL CHECK (length(btrim(summary)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION izakhono_reject_correspondence_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'agency_correspondence_is_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER agency_correspondence_no_update
BEFORE UPDATE OR DELETE ON agency_correspondence
FOR EACH ROW EXECUTE FUNCTION izakhono_reject_correspondence_mutation();

CREATE INDEX idx_works_publisher ON works(publisher_id);
CREATE INDEX idx_editions_work ON editions(work_id);
CREATE INDEX idx_editions_status ON editions(status);
CREATE INDEX idx_applications_status ON agency_applications(status);
CREATE INDEX idx_isbn_status ON isbn_records(verification_status);
CREATE INDEX idx_agency_correspondence_application ON agency_correspondence(application_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, created_at DESC);
