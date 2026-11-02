# iKhokha Integration Status V1

## Current status

**REFERENCE_ONLY — NOT LIVE**

The IZAKHONO STREAM control plane supports `IKHOKHA` as a payment provider in its provider-neutral entitlement model. This branch establishes the provider-specific sandbox acceptance boundary.

## What is implemented

- Canonical payment webhook contract boundary
- Durable entitlement persistence architecture
- Replay/idempotency requirements
- Entitlement lifecycle handling
- KORA NETWORK acceptance vectors
- iKhokha sandbox gate and evidence checklist

## What is not yet verified

- Live iKhokha credentials
- Provider-specific cryptographic webhook verification against the live provider environment
- Real sandbox transaction execution
- Remote production database execution
- Production webhook ingress
- Production payment-to-entitlement activation

## Next release gate

Execute the eight iKhokha sandbox vectors against an isolated environment, retain evidence, and only then promote the provider boundary toward production readiness.
