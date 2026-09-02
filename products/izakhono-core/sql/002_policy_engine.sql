BEGIN;

ALTER TABLE iz_core_table_policies
  ADD COLUMN IF NOT EXISTS scope_field text,
  ADD COLUMN IF NOT EXISTS read_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS write_roles text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE iz_core_table_policies
  DROP CONSTRAINT IF EXISTS iz_core_table_policies_mode_check;

ALTER TABLE iz_core_table_policies
  ADD CONSTRAINT iz_core_table_policies_mode_check
  CHECK (mode IN ('owner', 'project', 'scope'));

CREATE TABLE IF NOT EXISTS iz_core_memberships (
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iz_core_users(id) ON DELETE CASCADE,
  scope_id text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, user_id, scope_id, role)
);

CREATE INDEX IF NOT EXISTS iz_core_memberships_lookup_idx
  ON iz_core_memberships(project_id, user_id, scope_id)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS iz_core_row_grants (
  project_id text NOT NULL REFERENCES iz_core_projects(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  row_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES iz_core_users(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, table_name, row_id, user_id)
);

CREATE INDEX IF NOT EXISTS iz_core_row_grants_user_idx
  ON iz_core_row_grants(project_id, user_id, table_name);

COMMIT;
