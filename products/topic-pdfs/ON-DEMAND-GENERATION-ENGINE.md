# On-Demand Topic PDF Generation Engine

## Product requirement

A visitor may request a guide on a topic that is not already in the catalogue. The 25-topic queue is a market-discovery backlog, not a generation allow-list. The platform must accept any lawful, supportable topic brief and create a new, scoped production job without requiring an administrator to pre-author every topic.

The customer-facing promise is: **“Tell us what you want to understand. We will build a focused guide for your needs.”**

Do not promise instant, verified publication. The product can accept a request at any time; generation may take time, and high-stakes topics require specialist review before release.

## Reader request

Required:
- Topic / question.
- Desired reader outcome.
- Intended audience.
- Output language.

Optional:
- Country or jurisdiction.
- Depth: quick, practical, comprehensive.
- Include worksheets and examples.
- Reader's preferred context and constraints.

The platform should clarify an ambiguous brief, suggest a scope, and show the user the exact guide they are requesting before production begins.

## End-to-end production pipeline

1. **Intake** — validate brief, normalize topic, identify language/audience/geography, apply abuse controls.
2. **Scope** — define what the guide will and will not cover; identify currentness requirements and local context.
3. **Risk triage** — classify legal, medical, financial, safety and other high-stakes domains. Harmful or illegal facilitation requests are blocked or redirected to safe alternatives.
4. **Research** — search authoritative sources; prefer primary regulators, official agencies, standards bodies, peer-reviewed research and original documentation. Save source title, publisher, URL, publication/update date, access date, claim supported and rights notes.
5. **Evidence map** — connect substantive factual claims to sources. Flag unsupported, contradictory, stale or uncertain claims.
6. **Outline** — create a coherent learning sequence and practical outcomes.
7. **Original drafting** — write original prose, examples, checklists, worksheets and tables. Do not copy books, courseware, websites or proprietary curricula.
8. **Quality review** — check factual support, source freshness, calculations, internal consistency, completeness, accessibility and copyright.
9. **Specialist review** — required for high-stakes topics. A qualified reviewer must be recorded; AI self-review is not a substitute.
10. **Editorial approval** — human editor approves the final content and edition.
11. **PDF production** — render accessible PDF, inspect fonts, page breaks, links, tables, metadata, language glyphs and integrity.
12. **Publication and delivery** — publish only an approved immutable version; provide secure customer access, receipt, version and update policy.

## Risk model

- Standard: general informational topics; ordinary editorial and factual checks.
- Elevated: one high-stakes domain or local regulatory context; specialist review required before publication.
- High: multiple high-stakes domains, complex/uncertain claims, or material safety implications; specialist review and enhanced evidence threshold.
- Restricted: instructions that facilitate violence, weapons/explosives, cyber abuse, poisoning, self-harm or other wrongdoing. Block the harmful request and offer safe educational reframing where possible.

The keyword classifier in the first implementation is only a conservative routing aid. Production must use semantic triage plus human escalation; a keyword match must never be treated as a complete safety system.

## Job and publication states

Generation jobs:
`requested → scoping → research_required → drafting → quality_review → specialist_review (when required) → ready_for_editor → approved → rendering → delivered`

At any point a job can become `blocked` or `failed`. A retry must be idempotent and preserve the previous evidence and versions.

Publication lifecycle:
`editorial_draft → approved → published → withdrawn`

A generation job is not itself a saleable product. Only an approved publication record with verified source ledger, rights review, factual review, specialist review when required, editorial approval and a passing PDF QA report may be published.

## Architecture

- Existing IZAKHONO Builder Worker / D1 stack remains the hosting boundary for the first integration.
- Provider-neutral orchestration contract lives in `src/generation-core.ts`.
- D1 persists generation jobs, immutable event history and publication metadata.
- Research and model calls must go through the configured IZAKHONO-owned AI gateway/provider adapter. No provider key is hard-coded and no direct third-party subscription is assumed.
- PDF rendering reuses the existing ReportLab renderer after the manuscript passes review.
- Generated PDFs should be stored in private object storage; delivery uses short-lived, authorized links.
- Customer accounts, request quotas, abuse controls, payment and fulfilment are separate capabilities with explicit security review.
- No service-role key, provider credential or private storage credential may reach the browser.
- All externally supplied content is untrusted input; generated content is also untrusted until reviewed.

## Availability and honest UX

The request form can be available 24/7. The system must distinguish:
- Request accepted.
- Research in progress.
- Draft generated.
- Review required.
- Approved for sale.
- Delivered.

Do not display “ready” merely because text generation completed. Show the job status and expected review path. For specialist topics, offer a general educational guide while making limitations clear; never fabricate reviewer approval.

## Commercial model

- Target price: US$7 for a standard, approved digital guide.
- The customer must see the scope, edition, language, delivery format, price and refund terms before checkout.
- Customised high-stakes work, specialist review or unusually large research scopes may not fit the standard US$7 offer. Route these to a clearly described alternative rather than silently lowering quality.
- Do not charge for a guide that the system cannot safely and lawfully fulfil.
- No live payments or paid services are activated by this specification.

## Launch gates

1. Secure customer identity and ownership checks.
2. Public endpoint rate limits, bot protection, abuse monitoring and request quotas.
3. Provider routing, budget limits, timeout/retry/idempotency controls and audit logs.
4. Research adapter with source-quality scoring and citation persistence.
5. Evidence-to-claim validation and stale-source detection.
6. Human editorial and specialist review queues.
7. PDF rendering and automated plus human visual inspection.
8. Private storage and secure delivery.
9. Payment sandbox and refund/failed-fulfilment handling.
10. Privacy, consumer, tax, copyright and jurisdictional legal review.
11. Load, abuse, accessibility, security and end-to-end tests.

## Implementation status

The deterministic request/plan/risk/release-gate core is implemented and unit tested. D1 migration is prepared. Live AI research, text generation, PDF job execution, public customer API, authentication, payments and delivery remain separate implementation stages and must not be represented as operational until integrated and tested.
