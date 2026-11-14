-- IZAKHONO ONE DRIVE foundation; review against target CORE schema before apply.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS one_drive_spaces (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 space_kind TEXT NOT NULL CHECK (space_kind IN ('personal','business')),
 owner_user_id TEXT,
 organisation_id UUID,
 display_name TEXT NOT NULL,
 quota_bytes BIGINT NOT NULL DEFAULT 53687091200 CHECK (quota_bytes > 0),
 used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
 reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('provisioning','active','suspended','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((space_kind='personal' AND owner_user_id IS NOT NULL AND organisation_id IS NULL)
     OR (space_kind='business' AND organisation_id IS NOT NULL AND owner_user_id IS NULL)),
 CHECK (used_bytes + reserved_bytes <= quota_bytes)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_drive_personal_owner_uq ON one_drive_spaces(owner_user_id) WHERE space_kind='personal';
CREATE UNIQUE INDEX IF NOT EXISTS one_drive_business_org_uq ON one_drive_spaces(organisation_id) WHERE space_kind='business';

CREATE TABLE IF NOT EXISTS one_drive_memberships (
 space_id UUID NOT NULL REFERENCES one_drive_spaces(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (space_id,user_id)
);

CREATE TABLE IF NOT EXISTS one_drive_objects (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 space_id UUID NOT NULL REFERENCES one_drive_spaces(id) ON DELETE CASCADE,
 parent_id UUID REFERENCES one_drive_objects(id) ON DELETE RESTRICT,
 object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL,
 mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
 size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
 checksum_sha256 TEXT,
 object_state TEXT NOT NULL DEFAULT 'pending' CHECK (object_state IN ('pending','quarantined','available','deleted')),
 version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
 created_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 deleted_at TIMESTAMPTZ,
 UNIQUE (space_id,parent_id,filename,version_number)
);
CREATE INDEX IF NOT EXISTS one_drive_objects_space_parent_idx ON one_drive_objects(space_id,parent_id,created_at DESC);
CREATE INDEX IF NOT EXISTS one_drive_objects_state_idx ON one_drive_objects(space_id,object_state);

CREATE TABLE IF NOT EXISTS one_drive_upload_reservations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 space_id UUID NOT NULL REFERENCES one_drive_spaces(id) ON DELETE CASCADE,
 object_id UUID NOT NULL REFERENCES one_drive_objects(id) ON DELETE CASCADE,
 idempotency_key TEXT NOT NULL,
 reserved_bytes BIGINT NOT NULL CHECK (reserved_bytes > 0),
 status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','committed','released','expired')),
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (space_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS one_drive_audit_events (
 id BIGSERIAL PRIMARY KEY,
 space_id UUID REFERENCES one_drive_spaces(id) ON DELETE SET NULL,
 actor_user_id TEXT,
 object_id UUID,
 action TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK (outcome IN ('allowed','denied','failed')),
 correlation_id TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS one_drive_audit_space_time_idx ON one_drive_audit_events(space_id,created_at DESC);

ALTER TABLE one_drive_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_drive_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_drive_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_drive_upload_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_drive_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON one_drive_spaces,one_drive_memberships,one_drive_objects,one_drive_upload_reservations,one_drive_audit_events FROM PUBLIC;
