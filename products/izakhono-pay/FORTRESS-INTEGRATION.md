# IZAKHONO PAY × SHELTON FORTRESS

## Purpose

FORTRESS is the security and trust layer protecting IZAKHONO PAY customers and merchants. The payment portal remains operationally independent so a FORTRESS outage cannot silently turn off payment verification or create a payment bypass.

## Customer-protection controls

1. **No raw card storage** — card entry stays with the connected regulated payment provider wherever possible.
2. **Signed provider callbacks** — provider webhook signatures must verify before any payment is accepted.
3. **Replay resistance** — duplicate/replayed provider events are fingerprinted and handled idempotently.
4. **Amount/currency verification** — a signed webhook must still match the stored payment intent.
5. **Merchant isolation** — each merchant/application gets its own identity and, later, its own rotated API credential.
6. **Admin protection** — high-risk administrative actions must be audited and should require stronger authentication before commercial launch.
7. **FORTRESS event outbox** — suspicious payment/API activity is written to a minimal security event stream for FORTRESS analysis without including card data, provider secrets, passwords or full sensitive payloads.
8. **Fail closed** — missing provider secrets, unconfigured databases, invalid signatures and verification failures do not fall back to an unsafe payment path.

## Security event envelope

FORTRESS-facing events should contain only the minimum information needed for detection and investigation:

```json
{
  "event_id": "fse_...",
  "occurred_at": "ISO-8601",
  "severity": "info|low|medium|high|critical",
  "category": "auth|webhook|payment_mismatch|replay|rate_limit|admin|infrastructure",
  "source": "izakhono-pay",
  "merchant_slug": "kora",
  "intent_id": "pi_...",
  "fingerprint": "sha256...",
  "details": {
    "provider": "paystack",
    "reason": "invalid_signature"
  }
}
```

Never include:
- raw card number/PAN
- CVV
- passwords
- PayFast passphrase
- Paystack secret key
- IZAKHONO PAY API keys
- session cookies
- full authentication tokens

## FORTRESS alpha boundary

The current FORTRESS project is still alpha and requires real-world proof before commercial production. Therefore IZAKHONO PAY will use a durable local security-event outbox first. FORTRESS ingestion can be enabled when its production endpoint, TLS, authentication, backup/restore and external-security-review gates are satisfied.

Until then, payment verification remains enforced directly by IZAKHONO PAY and the upstream regulated providers.

## Future protection layer

Once FORTRESS reaches production readiness it can add:
- merchant-device trust signals
- anomaly scoring
- repeated failed-payment/API abuse detection
- impossible-travel/admin-login alerts
- infrastructure health and certificate monitoring
- secret-rotation and configuration-drift alerts
- incident evidence timelines
- merchant-facing security posture reports

FORTRESS strengthens the customer experience; it does not replace PCI DSS, 3-D Secure, bank/acquirer controls, provider fraud tooling, privacy law or payment-system regulation.
