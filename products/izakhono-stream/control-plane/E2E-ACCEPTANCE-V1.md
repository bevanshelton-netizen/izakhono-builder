# IZAKHONO STREAM — PAYMENT → ENTITLEMENT → PLAYBACK E2E ACCEPTANCE V1

## Purpose

This acceptance boundary verifies the authoritative customer journey from a normalized payment event through entitlement state and playback authorization.

## Required chain

1. Provider event is authenticated and normalized.
2. Event is deduplicated by tenant/provider/event identity.
3. PAID creates exactly one ACTIVE entitlement.
4. REFUNDED/CANCELLED/FAILED revoke or prevent activation.
5. Playback re-reads the authoritative entitlement.
6. Rights window is evaluated at request time.
7. Device policy is evaluated before media resolution.
8. HLS manifest resolution succeeds only after authorization.
9. Playback receives a short-lived token.
10. Tenant and identity boundaries prevent cross-account access.

## Acceptance matrix

| ID | Scenario | Expected |
|---|---|---|
| E2E-001 | PAID event | ACTIVE entitlement |
| E2E-002 | Duplicate PAID replay | No duplicate entitlement |
| E2E-003 | REFUNDED event | Entitlement revoked |
| E2E-004 | CANCELLED event | Entitlement revoked |
| E2E-005 | FAILED event | No active entitlement |
| E2E-006 | Authorized playback | HLS manifest + short-lived token |
| E2E-007 | Missing entitlement | Playback denied |
| E2E-008 | Wrong tenant | Playback denied |
| E2E-009 | Wrong identity | Playback denied |
| E2E-010 | Expired entitlement | Playback denied |
| E2E-011 | Disallowed device | Playback denied |
| E2E-012 | Missing media resolution | Playback denied |

## Production evidence rule

This document defines the acceptance boundary. It does not claim that the tests have been executed against a remote production database, live iKhokha credentials, production DRM, CDN, or production playback infrastructure.

Production readiness requires retained executable test output, isolated database evidence, provider sandbox evidence, reconciliation evidence, media playback evidence, backup/restore evidence, and security audit evidence.
