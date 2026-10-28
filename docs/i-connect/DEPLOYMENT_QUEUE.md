# I-CONNECT Deployment Queue

## Purpose

Keep the I-CONNECT staging release ready for deployment without bypassing platform limits or promoting an unverified build.

## Current state

- Dedicated project: `i-connect-staging`
- Git branch: `i-connect-staging`
- Existing staging deployment: READY
- Integrated synthetic journey: prepared in source control
- Production carrier integration: not enabled
- Production payment credentials: not enabled
- Production RICA/compliance integration: pending

## Deployment gate

The next Vercel deployment must be attempted only when the account deployment quota permits it.

When available, verify:

1. Deployment completes successfully.
2. Deployment URL responds with HTTP 200.
3. I-CONNECT staging marker is visible.
4. Synthetic customer journey can be exercised.
5. Payment simulation is idempotent.
6. Order transitions to `READY_TO_PROVISION` after simulated payment.
7. Simulated provisioning transitions to `PROVISIONING`.
8. Operations visibility is present.
9. No production secrets or live carrier credentials are exposed.
10. Production release remains blocked until carrier, regulatory/RICA, payment, security and operational gates are independently verified.

## No false-green rule

A successful Vercel deployment is a staging infrastructure result only. It is not evidence of MVNO activation, ICASA approval, commercial launch, or live telecom connectivity.
