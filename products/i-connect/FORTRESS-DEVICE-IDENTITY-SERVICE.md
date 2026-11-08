# FORTRESS Device Identity Service
**Deployment:** Supabase Edge Function `fortress-device-identity`, version 2, JWT verification enabled.
**Database:** Supabase project `qczsgkuqfehrrqebnrbi`.
**Status:** Deployed foundation; application integration and independent security testing remain outstanding.

## Actions
All calls are authenticated POST requests with a valid Supabase access token.
- `challenge`: starts device enrolment; requires AAL2; limits challenge creation to five per user/session per ten minutes.
- `register`: verifies one-time challenge proof using ECDSA P-256 / SHA-256 and registers the public key; requires AAL2.
- `verify_session`: checks that the current Auth session exists, is mapped to a registered device, and that the device remains active.
- `list_devices`: lists only the authenticated user's device inventory.
- `revoke_device`: revokes a device and its FORTRESS session mappings; requires AAL2.
- `revoke_all_devices`: revokes all registered devices and requests Supabase Auth global sign-out; requires AAL2.

## Cryptographic enrolment contract
The client creates an ECDSA P-256 key pair in its platform secure keystore. The private key never leaves the device. The client sends the public key in DER SubjectPublicKeyInfo (SPKI), base64 encoded. FORTRESS derives a SHA-256 fingerprint, issues a random one-time challenge valid for five minutes, and stores only its hash. The client signs the challenge bytes using ECDSA/SHA-256 and submits the raw 64-byte r||s signature, base64 encoded. The server verifies proof of possession before consuming the challenge and registering the device.

## Data protection
Device registry, device-session mapping, enrolment challenge and audit tables have RLS enabled and no direct privileges for `anon` or `authenticated`. Only the server service role has table privileges. The Auth session existence check is a SECURITY DEFINER function with an empty search_path and EXECUTE restricted to service_role.

## Critical integration boundary
A revoked device is denied by FORTRESS only when protected application APIs call `verify_session` or enforce an equivalent server-side gate. Supabase JWT access tokens remain valid until expiry after refresh-token revocation; single-device revocation does not itself invalidate the underlying Supabase Auth token. The `revoke_all_devices` action also requests global Auth sign-out. Sensitive application APIs must not rely on JWT validity alone where immediate device revocation is required.

## Deployment configuration
- Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime.
- Set `FORTRESS_ALLOWED_ORIGINS` to a comma-separated exact allow-list before browser-based app integration. Native mobile requests without an Origin header are authenticated by JWT and device proof.
- Keep `verify_jwt=true`; never expose the service role key to clients.
- Device-management operations require Supabase AAL2. Users must enrol and verify a second factor before registering or revoking devices.

## Not yet certified
No claim of impenetrability, hardware attestation, penetration-test clearance, end-to-end communications encryption, or universal app-wide enforcement is made. Android/iOS secure-keystore integration, client signing implementation, protected API middleware, rate-limit load testing, operational alerts, backup/restore and independent mobile/API penetration testing remain release gates.
