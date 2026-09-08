PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS creator_profiles(
  id TEXT PRIMARY KEY,
  app_slug TEXT NOT NULL,
  user_ref TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  stage_name TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT 'ZA',
  identity_verified INTEGER NOT NULL DEFAULT 0 CHECK(identity_verified IN(0,1)),
  roles_json TEXT NOT NULL DEFAULT '[]',
  tax_reserve_bps INTEGER NOT NULL DEFAULT 1500,
  emergency_reserve_bps INTEGER NOT NULL DEFAULT 1000,
  reinvestment_bps INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_slug,user_ref)
);

CREATE TABLE IF NOT EXISTS protected_works(
  id TEXT PRIMARY KEY,
  app_slug TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
  title TEXT NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'sound_recording',
  isrc TEXT,
  iswc TEXT,
  release_status TEXT NOT NULL DEFAULT 'draft'
    CHECK(release_status IN('draft','review','blocked','cleared','released','disputed','takedown')),
  contains_samples INTEGER NOT NULL DEFAULT 0 CHECK(contains_samples IN(0,1)),
  is_cover INTEGER NOT NULL DEFAULT 0 CHECK(is_cover IN(0,1)),
  involves_minor INTEGER NOT NULL DEFAULT 0 CHECK(involves_minor IN(0,1)),
  ai_assisted INTEGER NOT NULL DEFAULT 0 CHECK(ai_assisted IN(0,1)),
  platform_licence_granted INTEGER NOT NULL DEFAULT 0 CHECK(platform_licence_granted IN(0,1)),
  radio_clearance_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(radio_clearance_confirmed IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rights_shares(
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES protected_works(id) ON DELETE CASCADE,
  rights_lane TEXT NOT NULL CHECK(rights_lane IN('composition','master','performance','mechanical')),
  party_id TEXT NOT NULL,
  party_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  share_bps INTEGER NOT NULL CHECK(share_bps BETWEEN 0 AND 10000),
  society_name TEXT,
  society_member_ref TEXT,
  evidence_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id,rights_lane,party_id)
);

CREATE TABLE IF NOT EXISTS protection_contracts(
  id TEXT PRIMARY KEY,
  work_id TEXT REFERENCES protected_works(id),
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id),
  template_code TEXT NOT NULL,
  title TEXT NOT NULL,
  counterparty_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN('draft','review','lawyer_required','ready_to_sign','signed','terminated','superseded','disputed')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  red_flags_json TEXT NOT NULL DEFAULT '[]',
  effective_date TEXT,
  term_end_date TEXT,
  document_ref TEXT,
  document_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_signatures(
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES protection_contracts(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  signer_contact TEXT NOT NULL DEFAULT '',
  signature_method TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  evidence_ref TEXT,
  evidence_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rights_clearances(
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES protected_works(id) ON DELETE CASCADE,
  clearance_type TEXT NOT NULL CHECK(clearance_type IN('sample','beat','cover','master','composition','platform','radio','minor_guardian','ai_source')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','cleared','rejected','expired')),
  licensor_name TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  territory TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  evidence_ref TEXT,
  evidence_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rights_disputes(
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES protected_works(id),
  opened_by TEXT NOT NULL,
  disputed_lane TEXT NOT NULL CHECK(disputed_lane IN('composition','master','performance','mechanical','platform','other')),
  disputed_party_id TEXT,
  disputed_share_bps INTEGER CHECK(disputed_share_bps BETWEEN 0 AND 10000),
  claim_summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','under_review','resolved','withdrawn','legal_hold')),
  payout_hold_scope TEXT NOT NULL DEFAULT 'disputed_share_only',
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS artist_reserve_plans(
  creator_id TEXT PRIMARY KEY REFERENCES creator_profiles(id) ON DELETE CASCADE,
  tax_reserve_bps INTEGER NOT NULL DEFAULT 1500,
  emergency_reserve_bps INTEGER NOT NULL DEFAULT 1000,
  reinvestment_bps INTEGER NOT NULL DEFAULT 1000,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(tax_reserve_bps+emergency_reserve_bps+reinvestment_bps<=10000)
);

CREATE TABLE IF NOT EXISTS protection_events(
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  work_id TEXT,
  contract_id TEXT,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  evidence_sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS protection_events_no_update
BEFORE UPDATE ON protection_events
BEGIN
  SELECT RAISE(ABORT,'protection_events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS protection_events_no_delete
BEFORE DELETE ON protection_events
BEGIN
  SELECT RAISE(ABORT,'protection_events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS contract_signatures_no_update
BEFORE UPDATE ON contract_signatures
BEGIN
  SELECT RAISE(ABORT,'contract signatures are immutable; supersede the contract instead');
END;

CREATE TRIGGER IF NOT EXISTS contract_signatures_no_delete
BEFORE DELETE ON contract_signatures
BEGIN
  SELECT RAISE(ABORT,'contract signatures are immutable');
END;

CREATE INDEX IF NOT EXISTS rights_shares_work_lane_idx ON rights_shares(work_id,rights_lane);
CREATE INDEX IF NOT EXISTS contracts_creator_status_idx ON protection_contracts(creator_id,status);
CREATE INDEX IF NOT EXISTS disputes_work_status_idx ON rights_disputes(work_id,status);
