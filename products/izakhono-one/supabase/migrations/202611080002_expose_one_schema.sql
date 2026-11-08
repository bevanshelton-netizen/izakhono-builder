-- This project exposed only public before the Software NODE control-plane rollout.
-- Preserve public and add the service-only schema one. Table grants and RLS still
-- deny anon/authenticated access; only service_role has the required privileges.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, one';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
