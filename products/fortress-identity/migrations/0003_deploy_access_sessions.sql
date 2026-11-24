PRAGMA foreign_keys = ON;

-- Short-lived, resource-scoped DEPLOY access capabilities.
-- The parent access JTI ties each capability to a live FORTRESS session.
CREATE TABLE deploy_access_sessions (
  jti TEXT PRIMARY KEY,
  parent_access_jti TEXT NOT NULL,
  principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY(parent_access_jti) REFERENCES refresh_sessions(access_jti) ON DELETE CASCADE
);

CREATE INDEX deploy_access_sessions_principal_expiry
  ON deploy_access_sessions(principal_id, expires_at);

CREATE INDEX deploy_access_sessions_parent
  ON deploy_access_sessions(parent_access_jti, revoked_at);
