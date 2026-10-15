# IZAKHONO CALLBACK™ v1
## Product specification and build contract

**Product promise:** Turn advertising intent into requested conversations, appointments and measurable outcomes.

**Initial deployment:** Edu-Build admissions callback workflow.
**Commercial platform:** IZAKHONO Agent Flow + IZAKHONO Voice.
**Architecture principle:** Owned-first, software-first, provider-replaceable, evidence-gated.

## 1. Customer journey

`Advert / social post / website → Request a Call → validate request + purpose → consent/request record → callback queue → scheduled call → call outcome → appointment/application → CRM follow-up`

A call request is not proof of consent to unrelated marketing. Store the exact wording, purpose, channel, timestamp and affirmative action the person took. For unsolicited electronic direct marketing, use a consent process compliant with POPIA section 69 and the applicable prescribed Form 4 or substantially similar process. A prospect who declines or withdraws permission must not be called for that purpose.

## 2. Initial Edu-Build form

Required:
- Full name
- Mobile number
- Course interest (NQF Level 4, NQF Level 5, Inclusive Education, unsure)
- Preferred campus/area
- Preferred callback window
- Reason for enquiry
- Explicit request to be called for this enquiry

Optional:
- Email
- Existing enquiry/reference ID
- Campaign/ad identifier

Display:
- Edu-Build identity and contact details
- Privacy notice and purpose
- Clear submit button: **REQUEST MY CALL**
- Confirmation that the request has been received; do not promise an exact call time unless the scheduler has accepted it.

Do not collect identity numbers, health details or other unnecessary sensitive data in the callback form.

## 3. Lead/callback state machine

- `received`
- `needs_review`
- `queued`
- `scheduled`
- `calling`
- `connected`
- `no_answer`
- `busy`
- `failed`
- `reschedule_requested`
- `appointment_booked`
- `application_started`
- `converted`
- `human_follow_up`
- `cancelled`
- `opted_out`

Transitions must be timestamped and attributable to a system action or authorised staff member. Enforce retry limits and quiet hours. A no-answer retry is allowed only within the person's stated callback request and configured policy; never retry after opt-out or withdrawal.

## 4. Engines

1. **Ad Connect:** campaign, channel, landing page and source attribution.
2. **Request Intake:** validation, duplicate detection, rate limiting and spam controls.
3. **Consent & Purpose Ledger:** exact notice/version, purpose, channel, action, timestamp, source, status, withdrawal and evidence reference.
4. **Callback Scheduler:** timezone-aware preferred windows, business hours, queue and retry limits.
5. **Voice Adapter:** replaceable SIP/carrier integration. A request may be queued while voice connectivity is unavailable; never label it as called.
6. **Conversation/Qualification:** identify the organisation and AI assistant, answer approved FAQs, capture course interest and offer a human handover.
7. **Appointment Engine:** staff availability, booking, cancellation and rescheduling.
8. **CRM/Admissions Handoff:** outcome, next action, owner and secure internal notification.
9. **Analytics:** requests, eligible callbacks, connection rate, appointments, applications, conversions and opt-outs.
10. **Audit & Recovery:** append-only event trail, idempotency, retry-safe jobs and failure queues.

## 5. Suggested data model

### callback_requests
- id (UUID)
- tenant_id / organisation_id
- full_name
- phone_e164
- email (nullable)
- interest_code
- campus_or_area
- preferred_window
- source_channel
- campaign_id
- external_reference (nullable)
- request_status
- assigned_team (nullable)
- created_at, updated_at

### consent_events
- id (UUID)
- callback_request_id
- purpose
- channel
- notice_version
- affirmative_action
- evidence_type / evidence_reference
- occurred_at
- status (granted, declined, withdrawn, superseded)
- captured_by

### callback_jobs
- id (UUID)
- callback_request_id
- scheduled_at
- timezone
- attempt_count
- status
- provider_adapter
- provider_call_id (nullable)
- last_error_code (nullable)
- created_at, updated_at

### callback_outcomes
- id (UUID)
- callback_job_id
- outcome_code
- summary (minimum necessary)
- appointment_reference (nullable)
- next_action_at (nullable)
- created_at

### suppression_entries
- id (UUID)
- tenant_id
- phone_e164 / email
- scope
- reason
- created_at

Use tenant isolation and database-enforced access controls. Public intake must only create a minimal request through a validated server-side endpoint; never expose service-role secrets or unrestricted database writes in a browser.

## 6. API contract (v1)

- `POST /api/callback-requests` — validate and record a customer-requested callback; rate-limited and idempotent.
- `GET /api/callback-requests/:id/status` — return only a safe receipt/status using an unguessable reference or authenticated session.
- `POST /api/callback-requests/:id/reschedule` — verify requester authority and record a new window.
- `POST /api/callback-requests/:id/cancel` — cancel pending callback and prevent queued attempts.
- `POST /api/webhooks/voice/:provider` — authenticated/signature-verified provider event ingestion.
- Internal authorised endpoints for queueing, claiming, scheduling, outcomes and human handoff.

Do not implement a public endpoint that can initiate arbitrary outbound calls to any phone number. Outbound jobs must reference a validated request, purpose, current permission status and allowed callback window.

## 7. Voice script — Edu-Build

Opening:
“Hello, may I speak with [first name]? I'm the automated admissions assistant calling on behalf of Edu-Build Institute because you requested a callback about [course/enquiry]. Is now a convenient time?”

If yes:
“Thank you. I can help with general course information and arrange for an admissions adviser to assist. Which course or campus would you like to discuss?”

Rules:
- Identify the organisation and disclose that the assistant is automated/AI.
- Do not claim accreditation, admission, bursary, employment or qualification outcomes beyond approved, verified Edu-Build information.
- Do not take payment-card details or sensitive identity data on the call.
- If asked for a person, transfer or create a human follow-up.
- If the person says stop / don't call / wrong number, stop immediately, mark suppression and cancel pending jobs.
- Record call outcome and only the minimum necessary summary; recording/transcription requires appropriate notice and legal review.

## 8. Security, privacy and compliance gates

- POPIA purpose limitation, data minimisation, notice, retention/deletion policy and access/correction process.
- Use the prescribed Form 4 or a legally reviewed substantially similar consent process when the workflow is requesting consent for unsolicited electronic direct marketing. An ad callback request must not be repurposed into unrelated marketing without an appropriate basis.
- Respect objections, withdrawals, applicable pre-emptive blocks/opt-out registry requirements and current CPA/POPIA rules.
- Role-based access, tenant isolation, RLS/policies, server-side secrets, rate limits, audit trail and webhook signature verification.
- Retention schedule and deletion workflow; avoid indefinite call recordings.
- Legal/privacy review before enabling automated outbound calling at scale.

## 9. Commercial packaging

Pricing is a proposed subscription baseline, not unlimited usage:
- START — R499/month: request widget, lead inbox, callback queue and basic reports.
- BUSINESS — R999/month: workflow automation, appointment handoff, industry templates and integrations.
- PRO — R1,999/month: multiple campaigns/departments, advanced routing and analytics.
- ENTERPRISE — custom.
- Setup/customisation may be charged separately.
- Voice minutes, carrier, AI usage, recording storage and messaging are metered or capped with transparent allowances and overage controls.

## 10. Release gates

### Gate A — Intake MVP
- Mobile-responsive request form
- Validation and duplicate/rate-limit protection
- Consent/request event ledger
- Secure storage and tenant isolation
- Staff callback queue
- Manual callback option
- Test cases for opt-out, cancellation, duplicate submission and invalid phone

### Gate B — Scheduled workflow
- Preferred-window scheduler and timezone handling
- Retry/quiet-hour policies
- Secure event log and failure queue
- Appointment and human handoff

### Gate C — Voice integration
- Approved SIP/carrier adapter and credentials configured by owner
- Inbound/outbound call tests with authorised test numbers
- Signed provider webhooks and idempotent outcomes
- Recording/transcription policy verified
- Emergency stop / disable outbound control
- Real call evidence before marking operational

### Gate D — Launch
- Edu-Build admissions approves course knowledge and scripts
- Privacy notice, retention, consent and Form 4 process reviewed
- Mobile/browser QA, accessibility, security and load checks
- Production URL and health checks verified
- Dashboard distinguishes simulated, queued, attempted, connected and completed calls
- No “live calling” claim until Gate C passes

## 11. Non-negotiable engineering principles

- Build the engine, not only the dashboard.
- Owned-first and externally reversible.
- Carrier is an adapter; IZAKHONO owns workflow, policy, data model and orchestration.
- No outbound call without a validated request/purpose and permission check.
- No fake call outcomes; no simulated activity presented as real.
- Preserve source/IP history; never overwrite legacy repositories to build this.
