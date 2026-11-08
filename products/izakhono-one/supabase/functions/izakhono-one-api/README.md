# IZAKHONO ONE API — Software NODE control-plane extension

This is the complete source snapshot for the existing `izakhono-one-api` Supabase Edge Function, including the Software NODE `node_control` action.

## Deploy

From the repository root, deploy the complete function source (not only this folder's helper code):

```bash
supabase functions deploy izakhono-one-api --project-ref yfawrenhudjomhnglfhq --no-verify-jwt
```

The function deliberately uses `verify_jwt=false` because it implements its own server-to-server control-token and node-agent-token authentication. Do not remove those checks or expose the control token to a browser.

## Control-plane security

- Control tokens are stored as SHA-256 hashes in `one.node_control_credentials`.
- Node-agent tokens are stored as SHA-256 hashes in `one.node_agent_credentials`; the raw token is returned once during registration only.
- Both credential tables have RLS enabled, no anon/authenticated policies, and service-role-only table grants.
- Workload authorization is gated through the same FORTRESS owner-role, authenticated, verified, execute/manage decision contract used by the Node gateway.
- Authorization and deployment verification are separate actions.

Apply the matching migration in `supabase/migrations/202611080001_node_control_credentials.sql` before deploying the function.

The function also contains existing IZAKHONO ONE API actions. Always deploy this complete source snapshot; never replace it with a node-only handler.
