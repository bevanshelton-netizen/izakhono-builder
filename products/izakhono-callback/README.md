# IZAKHONO CALLBACK™
Turn advertising intent into requested conversations, appointments and measurable outcomes.

## Status
**Specification and schema proposal committed. Not yet a live calling service.**

- Product/engineering contract: `docs/IZAKHONO-CALLBACK-V1.md`
- Proposed database schema: `products/izakhono-callback/migrations/0001_callback_core.sql`
- Initial deployment target: Edu-Build admissions
- Product integration target: IZAKHONO Agent Flow + IZAKHONO Voice
- Preferred timezone: Africa/Johannesburg
- Architecture: owned-first, provider-neutral voice adapter, explicit request/permission checks, tenant isolation

## What it will do
1. Capture a callback request from an advert, social post, landing page or website.
2. Store source attribution, stated purpose, preferred time and evidence of the request/permission.
3. Put eligible requests into a callback queue.
4. Schedule a call through a replaceable SIP/carrier adapter once configured.
5. Record genuine provider call events and outcomes.
6. Qualify the enquiry, book an admissions appointment or hand over to a human.
7. Report request-to-connection, appointment and conversion metrics.

## Build gates
- [ ] Review privacy notice and Form 4/substantially similar consent flow with Edu-Build's responsible party.
- [ ] Confirm authenticated staff/tenant model and RLS policies.
- [ ] Apply the schema through a reviewed migration.
- [ ] Build the mobile-first request widget and secure server intake.
- [ ] Build staff callback queue and manual fallback.
- [ ] Build scheduler, retry limits, quiet hours, cancellation and suppression checks.
- [ ] Configure and verify the voice/SIP adapter using authorised test numbers.
- [ ] Test real call events, appointment handoff, opt-out and emergency stop.
- [ ] Complete security/privacy/launch QA.
- [ ] Publish only after production acceptance evidence exists.

## Safety boundaries
- A request about a specific enquiry does not automatically authorise unrelated marketing.
- Do not call if the request is invalid, cancelled, withdrawn or suppressed.
- Do not expose database service-role keys or allow a public endpoint to dial arbitrary numbers.
- No call can be described as placed/connected unless the provider supplies verified event evidence.
- Do not store unnecessary sensitive information or retain recordings indefinitely.
- Existing Supabase projects have unrelated tables with RLS disabled; this product migration does not modify those tables. Resolve that separate security finding through a reviewed, table-by-table policy plan.

## Commercial baseline
START R499/month · BUSINESS R999/month · PRO R1,999/month · Enterprise custom.
Voice usage is metered or capped; no unlimited calling is implied.
