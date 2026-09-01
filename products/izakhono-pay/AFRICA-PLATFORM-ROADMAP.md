# IZAKHONO PAY — African Payments Platform Roadmap

## North star

IZAKHONO PAY is intended to become an African merchant payments platform where independent businesses can accept online payments through one integration while IZAKHONO PAY orchestrates licensed payment rails underneath.

The IZAKHONO portfolio is the first merchant cohort and validation environment.

## Security position

SHELTON FORTRESS is the trust and security layer around IZAKHONO PAY.

FORTRESS must protect:
- merchant and administrator sign-in
- API credentials and secret rotation workflows
- payment-intent abuse and anomalous request patterns
- webhook source/signature validation telemetry
- replay and duplicate-event detection signals
- merchant-device trust signals where the FORTRESS agent is deployed
- audit trails for high-risk administrative actions
- infrastructure health, TLS, backup and restore evidence

FORTRESS must not be represented as a replacement for PCI DSS, bank/acquirer controls, card-network security, 3-D Secure, provider fraud tools, or regulatory obligations. Raw card data should remain with regulated payment providers wherever possible.

## Phase 1 — IZAKHONO-owned merchants

- onboard IZAKHONO-owned applications as separate merchant/project identities
- issue payment intents from one API
- route ZAR transactions through configured Paystack and PayFast adapters
- centralise provider webhook verification, idempotency and transaction status
- keep payment credentials server-side
- fail closed when production configuration is incomplete
- send security/audit events to the FORTRESS layer without exposing payment secrets

Initial merchant candidates discovered in the current GitHub portfolio include:
- KORA
- ALLEGRO-VIBEZ
- ECD360
- FAISReady
- VIDEONOMY
- DOXA-SURE
- The Chancellor
- IZAKHONO Group / commerce properties
- Bevan Shelton Racing and future digital purchases

Each application should integrate with IZAKHONO PAY rather than directly embedding gateway secrets.

## Phase 2 — External African merchant beta

- merchant organisation accounts
- KYB/onboarding status and compliance workflow
- per-merchant API credentials and webhook signing secrets
- hosted checkout and payment links
- merchant transaction dashboard
- refunds and reconciliation
- per-merchant branding and return URLs
- merchant-level limits and fraud/risk rules
- FORTRESS-backed security event dashboard

## Phase 3 — Multi-country African routing

Add provider adapters country by country rather than pretending one processor covers Africa.

Routing dimensions:
- merchant country
- customer country
- currency
- payment method
- provider availability
- provider success rate
- transaction cost
- risk policy
- settlement requirements

Potential rails can include cards, bank/EFT, mobile money, QR, wallets and country-specific providers where the merchant and provider relationship legally supports them.

## Phase 4 — Pan-African commerce portal

Goal: a shopper can pay an IZAKHONO PAY merchant online through a familiar checkout across participating African markets, while merchants use one IZAKHONO PAY integration.

Long-term capabilities:
- multi-currency pricing
- country-local payment methods
- merchant settlement reporting
- subscriptions
- split payments/marketplaces only after the required regulatory and banking structure exists
- payout orchestration
- disputes and chargeback workflows
- merchant risk scoring
- fraud rules
- optional trusted-device and business-security signals from FORTRESS
- developer SDKs and ecommerce plugins

## Regulatory boundary

The alpha is payment orchestration software, not a bank, acquirer, card network or stored-value wallet. It should not hold customer funds or store raw card numbers.

Before serving unrelated third-party merchants, holding or controlling funds, performing split settlements, or operating as a payment intermediary at scale, IZAKHONO PAY must complete the appropriate banking, PASA/NPS, privacy, PCI/security, consumer-protection and country-specific regulatory work.

## Launch rule

Security and payment readiness are separate gates. A product is not launch-ready merely because a checkout button renders. It must have:
1. deployed IZAKHONO PAY infrastructure;
2. configured merchant/provider credentials;
3. verified webhook flow;
4. payment-status reconciliation;
5. FORTRESS/audit controls appropriate to the release stage;
6. privacy/refund/terms readiness;
7. successful end-to-end test transaction in the correct environment.
