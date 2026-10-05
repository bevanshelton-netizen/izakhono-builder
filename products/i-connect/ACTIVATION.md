# I-CONNECT Production Activation

## Current architecture

The I-CONNECT web and Agent applications are deployed. Production activation is intentionally gated until the real backend, carrier bridge and payment provider are configured.

## Required production secrets

Configure these as protected production environment variables:

- `I_CONNECT_SUPABASE_URL` — dedicated I-CONNECT Supabase project URL.
- `I_CONNECT_SUPABASE_ANON_KEY` — publishable/anon client key for the dedicated project.
- `I_CONNECT_CARRIER_BRIDGE_URL` — authorised carrier/SIP bridge endpoint.
- `I_CONNECT_CARRIER_BRIDGE_SECRET` — server-side secret for the carrier bridge.
- `I_CONNECT_PAYMENT_PROVIDER_SECRET` — payment-provider server credential/webhook secret.

Do not place secrets in Git, browser JavaScript, HTML, screenshots or customer-visible configuration.

## Database gate

I-CONNECT has its own migration set under `supabase/migrations/` covering:

- organisations and memberships
- RBAC
- service entitlements
- contact-centre queues and agents
- authenticated agent sessions
- calls and call events
- provisioning jobs
- invoices and usage records
- private security helpers and audit events

These migrations must be applied to a **dedicated I-CONNECT Supabase project**. Do not apply them to unrelated IZAKHONO, Edu-Build or FAISReady databases.

## Activation order

1. Create/select the dedicated I-CONNECT Supabase project.
2. Apply the I-CONNECT migrations.
3. Create the CEO/owner organisation and initial administrator through the authenticated onboarding flow.
4. Configure the five protected production environment variables.
5. Connect the authorised carrier/SIP bridge.
6. Connect the payment provider and verify signed webhooks.
7. Run `/api/health` and require all production gates to report ready.
8. Perform a controlled test call, queue assignment, agent session, billing event and provisioning job.
9. Only then enable live PSTN and real billing.

## Safety boundary

Until all gates are green:

- `pstnLive` must remain `false`.
- `realBilling` must remain `false`.
- Demo fallback may remain available for UI testing.
- The platform must not claim live carrier service or real customer billing.

## Cost/approval gate

Creating a new Supabase project may incur a charge depending on the selected organisation and plan. The project must not be created automatically without the owner's explicit organisation selection and cost confirmation.
