# IZAKHONO CONTINUOUS EXECUTION ENGINE

## Purpose

Provide the missing layer between an approved IZAKHONO objective and a verified production result: the system must keep selecting the next safe task, execute it through an adapter, verify evidence, retry recoverable failures, and stop only on a genuine external gate.

## Operating contract

`OBJECTIVE → PLAN → QUEUE → EXECUTE → VERIFY → REPAIR → RETRY → PROMOTE → HANDOVER`

A completed task automatically unlocks the next dependency. There is no `NEXT` button in the workflow.

## Stop conditions

The engine may pause only when one of these is true:

1. owner credential/approval is required;
2. a financial transaction requires explicit authorization;
3. a physical node, DNS delegation, domain registrar, device or third-party account is required;
4. a safety/security policy blocks execution;
5. the evidence gate fails after the configured retry budget.

A normal build error is **not** a stop condition. It enters `REPAIR` and is retried.

## Evidence rule

Never mark `live`, `deployed`, `mail-ready`, `payment-ready`, or `customer-ready` from source code alone. Promotion requires the evidence checks declared by the task manifest.

## Adapter model

Adapters are replaceable capabilities, not foundations:

- `builder` — Hercules or another application builder;
- `code` — GitHub/IZAKHONO CODE;
- `deploy` — IZAKHONO NODE with Vercel as reversible fallback;
- `data` — IZAKHONO DATA/Supabase adapter;
- `dns` — IZAKHONO EDGE/Cloudflare adapter;
- `mail` — IZAKHONO MAIL/Mailcow adapter;
- `payments` — IZAKHONO PAY/iKhokha adapter;
- `security` — FORTRESS adapter;
- `observe` — IZAKHONO OBSERVE adapter.

## Continuous runner

`runner.mjs` is deliberately deterministic. It does not invent production claims. It reads `engine-manifest.json`, selects the next dependency-ready task, records transitions, and emits the adapter action required. A real adapter can be attached without changing the state machine.

## AI execution

The AI/build provider is an adapter. Hercules is one supported adapter because its ChatGPT integration is designed to build, edit and publish Hercules apps from chat. IZAKHONO remains provider-independent: no commercial product may require Hercules, OpenAI, Vercel or another external platform.

## Long-running execution

The scheduled GitHub worker is a heartbeat, not the source of truth. The long-term target is the same runner on IZAKHONO NODE/QUEUE so work continues independently of a browser session. External platforms remain reversible execution capacity.
