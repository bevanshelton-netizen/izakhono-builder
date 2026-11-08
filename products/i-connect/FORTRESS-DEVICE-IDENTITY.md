# FORTRESS — Device Identity & Session Security
**Status:** Implemented policy primitives; trusted adapters and persistence remain required.

## Purpose
Provide fail-closed, testable policy decisions for device enrolment, session access and revocation across I-CONNECT and IZAKHONO GLOBAL. This module is not an authentication provider and does not itself verify cryptographic signatures, attest hardware, issue tokens or persist revocations.

## Device enrolment
A device can become active only when the trusted server-side adapter confirms:
- The account is active.
- A one-time enrolment challenge is valid and unused.
- Proof of possession of the registered device private key is valid.
- Required platform attestation is verified.
- Any required user confirmation is present.
- A valid public-key fingerprint is recorded.

The private key must be generated and retained by the platform secure keystore where available. Never upload the private key. A fingerprint is an identifier, not proof; proof-of-possession verification must use a reviewed cryptographic implementation.

## Session authorisation
Every sensitive request must check account, device and session state, expiry, current account authentication epoch, step-up requirements, risk decision and exact scopes. Unknown scopes fail closed. Do not use user-editable profile metadata as an authorisation source. Enforce object ownership/tenant membership separately at the data boundary.

## Revocation
Lost-device and account-compromise flows must revoke refresh-token families, invalidate the device/session and increment the account authentication epoch. Sensitive APIs must validate the session against authoritative server-side state where immediate revocation is required; a JWT expiry alone does not provide immediate revocation.

## Adapter requirements before production
1. Use audited platform cryptography and secure-keystore APIs; no custom cryptography.
2. Implement one-time, expiring, replay-resistant challenges.
3. Persist device public keys, states, session IDs, token-family identifiers and auth epochs in private tables with restrictive RLS/grants.
4. Ensure every device/session lookup is tenant-bound and server-authorised.
5. Never expose service-role keys or private credentials in mobile clients.
6. Add rate limits, abuse controls, security-event audit, recovery notifications and lost-device flows.
7. Verify Supabase session revocation semantics and current docs before wiring Auth.
8. Add integration tests for concurrent revocation, refresh-token replay, account takeover, cross-tenant access and device replacement.

## Implemented policy module
`network/fortress-device-security.mjs` contains pure decision functions:
- `evaluateDeviceRegistration`
- `evaluateSessionAccess`
- `canRevokeDevice`
- `sessionRevocationPlan`

Automated tests are in `network/fortress-device-security.test.mjs`. These tests verify policy decisions only; they are not a penetration test or production security certification.
