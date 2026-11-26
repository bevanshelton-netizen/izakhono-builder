# IZAKHONO Communications — Conversation Hub

The Conversation Hub is the shared, provider-neutral customer conversation and AI-agent orchestration capability within IZAKHONO COMMUNICATIONS.

## Portfolio boundaries

- Reuses I-CONNECT for contact-centre and voice operations.
- Reuses IZAKHONO CONNECT for first-party internet messaging.
- Reuses IZAKHONO CRM for contacts, organisations, opportunities and activities.
- Delegates identity, permissions, tenant isolation and audit authority to FORTRESS.
- Uses the IZAKHONO AI Gateway / AI Workforce for model execution under Hub policy.
- Uses PAY for verified payment and refund state.
- Uses MAIL and product booking/order systems through explicit adapters.

## Domain contracts

- `src/conversation-hub-contracts.ts` contains pure domain guards for tenant scope, message evidence, channel capability, outbound consent, AI actions, human handover, routing and idempotency.
- `src/conversation-hub-contracts.test.ts` contains deterministic positive and negative tests.

These contracts do not connect to a database, provider, model, CRM, payment system or external channel. They do not constitute a deployed inbox or production integration.

## Local validation

```bash
npx --yes tsx@4.20.3 products/izakhono-communications/src/conversation-hub-contracts.test.ts
npx --yes --package typescript@5.9.2 tsc --noEmit --target ES2022 --lib ES2022,DOM --module NodeNext --moduleResolution NodeNext products/izakhono-communications/src/conversation-hub-contracts.ts products/izakhono-communications/src/conversation-hub-contracts.test.ts
```

See `docs/communications/IZAKHONO-CONVERSATION-HUB-ARCHITECTURE-V1.md` for product scope, current portfolio boundaries, privacy and release gates.
