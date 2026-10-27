# I-CONNECT Partner Onboarding Workflow

I-CONNECT owns the customer relationship, product catalogue, identity, billing/control layer and service orchestration. Network partners remain replaceable infrastructure providers.

## 1. Partner lifecycle

`TARGET → CONTACTED → NDA → COMMERCIAL_REVIEW → TECHNICAL_REVIEW → COMPLIANCE → PILOT → ACCEPTED → PRODUCTION_ELIGIBLE`

A partner is **not** production-ready merely because it appears in the registry.

## 2. Required onboarding pack

### Commercial
- Wholesale price sheets and minimum commitments
- Setup, activation, cancellation and porting fees
- Recurring charges and usage-rating rules
- SLA, service credits and escalation path
- Billing cycle, credit terms and dispute process
- Territory and product restrictions

### Technical
- API documentation and authentication model
- SIM/eSIM lifecycle APIs where applicable
- Address/serviceability lookup
- Order, activation, suspension, cancellation and migration flows
- Usage/CDR feeds where applicable
- Network health/status feeds
- Webhooks and retry/idempotency requirements
- Sandbox and production credentials
- IP allowlists, certificates and security requirements

### Compliance
- Contracting entity and authority to provide the service
- Required South African telecom/regulatory obligations
- RICA/KYC responsibilities for mobile products
- POPIA/data-processing responsibilities
- Data retention and lawful-request process
- Incident notification and security obligations

## 3. Technical acceptance gates

1. Authentication succeeds in sandbox.
2. Serviceability query returns deterministic results.
3. Order creation is idempotent.
4. Activation lifecycle can be reconciled.
5. Failure responses are mapped to I-CONNECT error codes.
6. Webhooks are authenticated and replay-safe.
7. Usage/billing records reconcile to partner records.
8. Health checks expose a measurable availability signal.
9. Rollback/cancellation behaviour is tested.
10. Production credentials are stored outside source control.

## 4. Production eligibility

A provider may enter `PRODUCTION_ELIGIBLE` only after commercial acceptance, technical acceptance, compliance sign-off and verified pilot evidence. The registry must never be used as evidence that a partnership has been signed.

## 5. Failover policy

Provider selection evaluates, in order:

1. Product compatibility
2. Customer contract constraints
3. Geographic/serviceability match
4. Provider health
5. Capacity/availability
6. SLA tier
7. Commercial cost
8. Configured provider priority

A provider switch must be explicit in the orchestration event, auditable, reversible and attributable to a policy decision. No silent provider substitution is allowed where the customer's contract requires a fixed provider.

## 6. I-CONNECT abstraction rule

The customer must retain the same I-CONNECT account, identity, product relationship and billing history when infrastructure changes. Provider-specific identifiers belong in the adapter/integration layer, not in the customer identity model.
