# IZAKHONO VOICE — subscription and customer onboarding flow

## Customer promise
IZAKHONO supplies the VOICE software. The customer keeps their current cellphone, SIM and mobile number. No compulsory handset, SIM, PBX or office phone purchase.

## Subscription-to-activation journey
1. Customer creates an account and verifies identity/contact details in the IZAKHONO customer application.
2. The application authenticates the user and resolves their tenant from the server-side session. Never accept a tenant ID from an untrusted browser field.
3. Customer selects a published flat subscription plan. The plan must state included features, fair-use/call allowances, carrier charges and overage terms before payment.
4. The payment adapter confirms payment and subscription status using a verified server-to-server event. A browser redirect or client-side paid flag is never proof of payment.
5. The trusted onboarding service checks the tenant's active subscription before requesting a number from the configured telephony-number provider.
6. The destination number is validated as E.164 and saved atomically with the tenant's enabled AI policy and BYOP endpoint metadata.
7. The customer enters their business name, existing mobile number, forwarding preference and business instructions. The software does not ask for SIM credentials.
8. The dashboard shows the assigned IZAKHONO answering number and carrier-specific forwarding instructions only when verified for that customer's carrier.
9. Customer activates forwarding with their carrier and makes a test call.
10. Only a successful controlled test changes forwarding status from pending to verified. The customer can then configure greetings, FAQs, transfer targets and notification preferences.

## Trusted server boundary
The VoiceTenantOnboardingService is the orchestration layer. It requires an authenticated tenant ID supplied by the application server, a subscription gate that confirms active entitlement, a number-provider adapter that provisions/releases numbers and supports idempotency, and a PostgreSQL setup repository that atomically enables the tenant policy, maps the assigned number and stores endpoint metadata.

No public signup route should call the repository directly. Authentication, account verification, payment verification and subscription entitlements belong in the trusted application layer. Provider webhooks must be signature-verified before changing billing status.

## Failure behaviour
- Inactive subscription: stop before number provisioning.
- Number provider failure: do not create tenant voice records.
- Invalid provider number: attempt provider release and fail closed.
- Database setup failure: rollback database changes and attempt provider release.
- Provider release failure: preserve the original error and send the allocation to provider reconciliation.
- Forwarding not tested: leave status pending. Do not tell the customer that the AI is answering calls yet.

## Carrier and payment adapters
The service depends on replaceable interfaces. No South African number inventory, carrier forwarding tariff, or payment-provider event is assumed. The production adapter must be selected and verified before customer checkout or number promises are enabled. iKhokha/payment integration must be wired to verified payment events and a subscription ledger before this onboarding service is exposed publicly.

The number-provider adapter must return `newlyProvisioned: true` only when this invocation created a new allocation. For an idempotent retry that returns an existing allocation, it must return `newlyProvisioned: false`; the onboarding service will never release a pre-existing number when a retry's database write fails. The provider must honour the tenant plus idempotency key consistently.


## Subscription entitlement source of truth
Migration `003_voice_subscription_entitlements.sql` adds `voice_tenant_subscriptions` and an idempotency/audit ledger for verified billing events. `PostgresVoiceSubscriptionGate` grants onboarding only when the tenant has an `active` subscription whose current billing period has not expired. The provider webhook adapter that verifies events and updates these records remains a separate trusted integration; no browser action can activate entitlement.


## Verified billing-event writer (implemented)

`runtime/src/billing-event-writer.ts` adds `PostgresVoiceBillingEventWriter`. It accepts only a canonical event produced by a trusted provider adapter after signature verification and tenant/subscription-reference resolution. The writer:

- validates provider/event/tenant references, subscription status, timestamps and SHA-256 payload hash;
- stores provider event IDs under a unique provider/event constraint for replay-safe idempotency;
- writes the event ledger and subscription entitlement in one PostgreSQL transaction;
- ignores duplicate provider event IDs without reapplying entitlement changes;
- applies subscription state only when the provider event timestamp is newer than the last verified event, preventing out-of-order webhook delivery from reverting a newer state;
- stores a payload hash rather than raw payment details.

The provider adapter remains responsible for verifying the provider's exact signature scheme against the unmodified request body, resolving the provider's customer/subscription reference to the authenticated IZAKHONO tenant, and mapping provider-specific states into the canonical status contract. Never accept a canonical event from a browser, checkout redirect, or public client request.

No iKhokha webhook format, signature header, recurring-subscription capability, or payment status mapping is assumed by this provider-neutral layer. Those must be verified against the merchant account and current provider documentation before a live adapter or checkout is enabled. The service is not yet connected to public signup or checkout.
