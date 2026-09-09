# Ubuntu AI Tutor — IZAKHONO Alpha

Owner-controlled cutover scaffold for Ubuntu AI Tutor.

## Current alpha

- mobile-first tutor UI
- `/api/tutor` safe fallback response path
- `/health` deployment health gate
- `/api/config` readiness signal without returning secrets
- Docker packaging for the IZAKHONO build-to-alpha gate
- explicit hooks for IZAKHONO Core, external AI provider, and PayFast

## Environment boundaries

Secrets are runtime-only. Do not commit values.

Optional runtime variables:

- `OPENAI_API_KEY` or `IZAKHONO_AI_ENDPOINT`
- `DATABASE_URL` or `IZAKHONO_CORE_URL`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `APP_ENV`

## Cutover sequence

1. Pass repository validation and container health gate.
2. Deploy alpha on an IZAKHONO-controlled host.
3. Connect IZAKHONO Core persistence/auth.
4. Connect AI gateway server-side only.
5. Add PayFast sandbox ITN and checkout.
6. Run student signup/tutor/payment tests.
7. Only then promote to public pilot.

Bolt remains a design/reference source during the cutover; it is not required by this runtime.
