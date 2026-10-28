# KORA Mail External Acceptance Runbook

## Purpose

Provide real-world evidence required before KORA owned mail may be promoted to `LIVE_VERIFIED`.

## Preconditions

- Runtime activation has passed static acceptance.
- The selected runtime node is one of `node01`–`node04`.
- Secrets are supplied only through the FORTRESS-protected runtime secret store.
- Do not commit passwords, API tokens, or message contents to the repository.

## Required evidence

The live gate requires four evidence files in the protected runtime evidence directory:

- `inbound.json` — an external sender successfully delivered mail to `info@streamkoraafrica.com`.
- `outbound.json` — KORA successfully sent mail to an external mailbox and the external service accepted it.
- `reply.json` — the external recipient replied and KORA received that reply.
- `authentication.json` — SPF, DKIM and DMARC all passed for the tested message flow.

## Evidence rules

Each evidence file must be produced by the external acceptance runner, not by the deployment script itself. Each file must contain its required boolean assertion:

- `inbound.json`: `received: true`
- `outbound.json`: `accepted: true`
- `reply.json`: `received: true`
- `authentication.json`: `passed: true`, plus `spf: true`, `dkim: true`, `dmarc: true`

The evidence must correspond to the same KORA mailbox and current runtime promotion attempt. Do not reuse stale evidence after a mail-runtime change unless the acceptance runner explicitly revalidates it.

## Promotion

Run `KORA-MAIL-LIVE-GATE.sh` only after all four evidence files are present. A successful gate writes `promotion.json` with `status: LIVE_VERIFIED`.

A missing, stale, malformed, or failed evidence item must leave promotion blocked.
