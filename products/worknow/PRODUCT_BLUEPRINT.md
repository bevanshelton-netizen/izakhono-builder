# WORKNOW — Africa-to-World Workforce Blueprint

## North star

**Africa to Africa. Africa to the world.** WORKNOW is an African-founded workforce technology and operations platform designed to connect talent, employers and opportunity across African markets and internationally. It should make cross-border work easier while increasing African ownership of software, data systems, intellectual property and operational capability.

**We don't buy. We build. We engineer. We own.** Build proprietary product capabilities and portable infrastructure. Use vetted partners only where law, payment rails, local expertise or physical delivery requires them. Keep integrations replaceable and avoid vendor lock-in.

This document adapts common global-workforce service capabilities into WORKNOW's own product strategy. It is not a reproduction of another provider's copy, branding, design or proprietary technology.

## Product portfolio

| Product | Purpose |
|---|---|
| WORKNOW Recruit | Employer vacancies, candidate discovery and consent-based applications |
| WORKNOW Employ | Offer, contract, onboarding, employee records and lifecycle administration |
| WORKNOW Payroll | Versioned payroll calculations, approvals, payslips, reconciliation and reporting |
| WORKNOW Global | Country capability, multi-currency workforce operations and cross-border workflows |
| WORKNOW Compliance | Country rules, evidence, obligations, case management and audit readiness |
| WORKNOW Benefits | Benefits enrolment, leave, statutory entitlements and employee self-service |
| WORKNOW Mobility | Immigration and relocation case tracking with qualified local providers |
| WORKNOW Equip | Equipment requests, procurement coordination, delivery, inventory and recovery |
| WORKNOW Expenses | Policy-based claims, approvals and payroll/accounting handoff |
| WORKNOW Equity | Equity award records, vesting schedules and country-specific reporting workflows |
| WORKNOW Intelligence | Natural-language operations assistant with permission checks, approvals and traceable actions |
| WORKNOW Insights | Workforce, hiring, payroll and cost analytics with exportable reports |

These modules share a secure workforce record and policy engine, but can be released independently. No module should imply a service is active in a country until its capability gate is approved.

## Customer journeys

### Employer
1. Create an organisation and verify its identity, ownership/authority and business purpose.
2. Choose the required workflow: recruit, employ, payroll, contractor administration or a supported country service.
3. See a scoped proposal with service inclusions, exclusions, fees, currency, assumptions and country limitations.
4. Complete a guided readiness checklist and provide required information securely.
5. Review and approve vacancies, offers, contracts, payroll inputs and high-impact actions.
6. Track progress, exceptions, evidence, invoices and support requests in one workspace.
7. Manage changes, leave, expenses, benefits, transfers and offboarding with an auditable history.

### Candidate and employee
1. Discover a clearly identified employer and verified vacancy.
2. Apply directly with explicit consent and a visible privacy notice.
3. Control profile visibility and manage submitted information.
4. Receive application acknowledgement and status updates where supported.
5. If hired, complete secure onboarding, contract review, payroll details and employee self-service.
6. Access payslips, leave, benefits, expenses and support according to the employer's enabled services.
7. Request correction, access or deletion where legally applicable; retention exceptions are explained.

## Country capability model

WORKNOW must not sell a country flag or global coverage number as a substitute for readiness. Each country/service combination has a published capability status:

- **Researching** — no customer delivery claim.
- **Connector only** — moderated listings and direct consent-based applications only, subject to local legal clearance.
- **Partner enabled** — a named, verified provider supports a defined service scope.
- **Entity enabled** — WORKNOW's own eligible entity can deliver the defined service.
- **Paused** — capability temporarily unavailable; affected customers receive a clear notice and continuity plan.

Country activation requires evidence for: current legal review and expiry date; employing entity or partner identity and authority; reviewed employment/contract templates; payroll and statutory rules with sources and effective dates; payment and reconciliation rails; tax and filing responsibilities; privacy/data-transfer assessment; security controls; local support; incident and continuity runbooks; customer disclosures; and accountable sign-off.

The first implementation slice is South Africa (ZA), and only the limited Connector Mode functions described in the README are in scope until legal and operational review is completed. Other African countries are sequenced by demand, readiness and ability to deliver responsibly—not by an unsupported coverage claim.

## Pricing and proposals

Use a transparent, itemised proposal rather than a headline price that hides country-specific costs. Show separately, as applicable:

- Platform subscription or workflow fee.
- Recruitment search fee and replacement terms.
- Employment administration fee.
- Payroll processing and statutory employer costs.
- Benefits, insurance and third-party charges.
- Immigration, relocation and equipment costs.
- FX rate source, timestamp, spread/fee and settlement currency.
- Setup, transition, termination and exceptional-service fees.

No published price should be represented as universally available until the delivery scope, country costs, taxes and contractual terms are verified. Customers must be able to compare the total expected cost and understand which costs are pass-throughs.

## WORKNOW Intelligence — controlled action assistant

The assistant should do more than answer questions, but it must not autonomously commit high-impact employment decisions.

Supported interaction pattern:
1. Interpret the user's request and identify the organisation, employee, country and intended action.
2. Check the user's role, permissions, service activation and applicable policy/rule version.
3. Show the proposed action, affected records, consequences, source/evidence and any missing information.
4. Require explicit approval for contracts, payroll, compensation, termination, immigration, candidate rejection and other sensitive/high-impact actions.
5. Execute through authenticated, idempotent server-side tools only after approval.
6. Record who requested, who approved, what changed, which rule/source was used, timestamps and result.
7. Provide a receipt and a correction/escalation path.

The assistant must not fabricate local law, rates, compliance status, country coverage, customer testimonials, certifications or completed actions. If a rule is missing, stale or disputed, it pauses and routes to a qualified human.

## Trust, security and privacy

- Tenant isolation and employer/candidate access checks on every server request.
- Least privilege, strong authentication, session protection and secure administrative access.
- Private CV/document storage, malware scanning, signed short-lived access and retention limits.
- Data minimisation; no CV or sensitive applicant payload in audit logs.
- Consent and privacy-notice version captured for each application or disclosure.
- Append-only audit events with tamper-evident controls and restricted access.
- Encryption in transit and at rest, secrets management, backups and tested recovery.
- Data residency and cross-border transfer decisions documented per jurisdiction.
- Incident response, breach assessment, customer communication and deletion/correction workflows.
- Security or certification claims only after independently verified scope and current evidence.

## Migration and continuity

For employers switching from another platform:
- Inventory employees, contracts, payroll calendars, balances, benefits, permissions and open cases.
- Validate source data and obtain lawful transfer authority.
- Map fields, currencies, country rules and historical records.
- Run parallel validation/reconciliation before a payroll cutover.
- Freeze and confirm cutover dates with the customer and provider.
- Provide exception handling, rollback/contingency and employee communications.
- Never promise a fixed migration duration before data quality and country complexity are assessed.

## Operating principles

- African markets are first-class markets, not a footnote to a global country list.
- Global architecture from inception: country-aware rules, language, currency, time zones and data-transfer controls.
- Human local expertise is embedded in country readiness and exception handling.
- Open, documented APIs and exportable customer data; avoid lock-in.
- No candidate-paid fees in the current Connector Mode.
- No EOR, payroll release, immigration decisions or regulated activity without the relevant authority, partner, controls and contractual scope.
- No unapproved infrastructure spend or production deployment.
- Product claims must match verified capability, not roadmap ambition.

## Delivery sequence

1. Complete and validate the current Connector Mode policy and migration tests.
2. Build authenticated server adapters with tenant and employer membership enforcement.
3. Implement moderation, employer verification, direct application and privacy controls.
4. Build employer and candidate portals with secure document handling.
5. Complete South African legal review and evidence-backed country capability record.
6. Implement sourced, effective-dated payroll rules, maker-checker, reconciliation and exception handling.
7. Add employee lifecycle, leave, benefits, expenses, equipment and reporting.
8. Add country/partner onboarding and a country-specific readiness dashboard.
9. Add controlled AI actions, approvals, idempotency and audit receipts.
10. Expand country by country only after signed readiness and operational testing.

## Current status disclaimer

This blueprint is product direction, not proof that WORKNOW is registered, licensed, an employer of record, a payroll provider, operational in any country, or certified to a security standard. The existing code slice is an early policy and persistence foundation. It must pass tests, security review, legal review and release gates before customer-facing production use.
