BEGIN;

CREATE TABLE IF NOT EXISTS iz_core_projects (
  id text PRIMARY KEY,
  public_key_hash text NOT NULL,
  allow_signup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iz_core_users (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  user_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);

CREATE INDEX IF NOT EXISTS iz_core_users_project_idx ON iz_core_users(project_id);

CREATE TABLE IF NOT EXISTS iz_core_refresh_tokens (
  token_hash text PRIMARY KEY,
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iz_core_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iz_core_refresh_user_idx ON iz_core_refresh_tokens(project_id, user_id);
CREATE INDEX IF NOT EXISTS iz_core_refresh_expiry_idx ON iz_core_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS iz_core_table_policies (
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('owner', 'project')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, table_name)
);

CREATE TABLE IF NOT EXISTS iz_core_rows (
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  row_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES iz_core_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, table_name, row_id)
);

CREATE INDEX IF NOT EXISTS iz_core_rows_owner_idx ON iz_core_rows(project_id, table_name, created_by);
CREATE INDEX IF NOT EXISTS iz_core_rows_data_gin_idx ON iz_core_rows USING gin(data);

CREATE TABLE IF NOT EXISTS iz_core_storage_objects (
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  object_path text NOT NULL,
  created_by uuid NOT NULL REFERENCES iz_core_users(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  byte_size bigint NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, bucket, object_path)
);

CREATE INDEX IF NOT EXISTS iz_core_storage_owner_idx ON iz_core_storage_objects(project_id, bucket, created_by);

CREATE TABLE IF NOT EXISTS iz_core_audit (
  id uuid PRIMARY KEY,
  project_id text,
  user_id uuid,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iz_core_audit_project_time_idx ON iz_core_audit(project_id, created_at DESC);

COMMIT;
