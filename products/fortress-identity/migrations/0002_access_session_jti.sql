ALTER TABLE refresh_sessions ADD COLUMN access_jti TEXT;
CREATE UNIQUE INDEX refresh_sessions_access_jti ON refresh_sessions(access_jti);
