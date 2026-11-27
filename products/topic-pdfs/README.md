# $7 Topic PDF Publishing Programme

**Owner and author:** Bevan Shelton  
**Product:** Original, focused, practical topic guides sold at a target price of **US$7 per PDF**.  
**Programme boundary:** This is separate from the full-length Book Publishing Programme and separate from Global Campus.

## What this programme is

The $7 Topic PDF Publishing Programme turns a clearly defined reader need into a standalone, carefully researched, original digital guide. Each product focuses on one topic or one problem and helps the reader understand it and take useful next steps.

The product is not a full-length book, a chapter extracted from a book, a book converted to PDF, or a generic collection of short slogans. The PDF is the delivery format for a focused knowledge product.

## What it is not

- It is not the principal book catalogue (for example, *MONEY, MADE PLAIN* and other full-length titles).
- It does not repackage, excerpt, or cannibalise book manuscripts without a separate editorial and rights decision.
- It is not a mass-produced AI content dump.
- It is not an institutional curriculum or an official university resource.
- It does not imply endorsement by a university, regulator, professional body or publisher.
- It does not promise a specific outcome or replace qualified professional advice in high-stakes domains.

## Product promise

Every guide should answer five questions:

1. What specific reader problem does this document address?
2. What does the reader need to understand?
3. What can the reader practically do next?
4. What local, legal, financial, health or safety context changes the advice?
5. What reliable sources support the material?

The reader should finish with greater clarity, a practical next step, and a useful reference they can return to.

## Standard production workflow

1. **Topic discovery** — collect questions and recurring problems from real-world needs, search intent, student/worker/household concerns and verified research.
2. **Topic definition** — write a one-sentence promise, target reader, scope, exclusions and intended outcome.
3. **Market and duplication check** — assess whether the topic is distinct, useful, discoverable and not already covered by an existing product.
4. **Research** — use credible, current, relevant sources; prioritise primary and official sources where appropriate.
5. **Original writing** — explain the subject in clear language, with examples, scenarios, steps, checklists or worksheets as appropriate.
6. **Accuracy and specialist review** — verify factual claims and obtain qualified review for high-stakes or specialist subjects.
7. **Rights and editorial review** — confirm originality, source attribution, permissions, privacy and image/font/asset licensing.
8. **PDF production** — apply consistent readable layout, navigation, metadata, accessibility checks and print-friendly design.
9. **Release QA** — inspect the rendered PDF, links, page flow, spelling, source list, disclaimers and file integrity.
10. **Publish and learn** — release at the US$7 target price, monitor legitimate customer feedback and update when facts or regulations change.

## Editorial minimum

A guide is ready only when it has:

- A specific title and reader promise
- A defined audience and geographic/jurisdictional scope
- A useful introduction that frames the problem
- Developed explanations, not just bullet-point fragments
- Practical steps and examples relevant to the topic
- A clear conclusion or action plan
- Sources and a review/update date
- Appropriate boundaries and escalation guidance for high-stakes topics
- A professionally rendered, checked PDF

Length is determined by the topic and reader need. Do not pad a short topic to imitate a book; do not compress a complex topic into a thin pamphlet merely to publish quickly.

## Topic coverage

The catalogue may span household finance, careers, business, family and relationships, education, technology, everyday legal literacy, health literacy, food, home and garden, personal development, recreation and other useful subjects.

Topic selection is global, but advice must be localised when laws, regulators, prices, currencies, services, medical guidance or cultural context differ. A single universal guide must not present jurisdiction-specific information as globally applicable.

## Trust, safety and rights

- Write original explanations; do not copy books, articles, websites, course materials or proprietary curricula.
- Public availability does not mean permission to republish.
- Keep a source record for material claims and distinguish evidence from opinion.
- Do not fabricate experts, testimonials, statistics, citations or personal stories.
- Use fictional or composite scenarios only when clearly labelled and not misleading.
- Protect personal information and obtain consent for identifiable real stories.
- Health, legal, financial and safety guides require proportionate review, careful scope and clear escalation to qualified help.
- Never market an independent guide as institution-approved without documented permission.
- Keep revision history and withdraw or correct material when important errors are found.

## Product metadata

Each product record should include:

- Stable product ID and slug
- Working title and subtitle
- Topic/category and keywords
- Reader profile and problem statement
- Promise, scope and exclusions
- Country/region and language
- Research sources and source access dates
- Author/editor/reviewer roles
- Rights and asset checks
- Draft, review, approved, published, update-needed or withdrawn status
- Version, publication date and next review date
- PDF file reference, page count and accessibility/QA status
- Price target (USD 7) and actual storefront price
- Sales/distribution links once approved

## Commercial rule

The intended standard price is **US$7 per focused PDF guide**. Local currency pricing, taxes, platform fees, discounts, bundles or payment arrangements may be added only as separately considered commercial decisions. No paid hosting, subscriptions, domains, advertising or infrastructure may be provisioned without explicit approval.

## Relationship to the other programmes

- **Book Publishing Programme:** full-length authored books, developed as books and published in suitable formats. The books remain separate titles and are not part of the $7 PDF catalogue.
- **Global Campus:** curriculum discovery and student-resource alignment. It may later surface relevant independent guides, but it does not own or redefine the PDF product.
- **$7 Topic PDF Publishing Programme:** a separate catalogue of focused, original topic guides.

## Initial release principle

Build a repeatable, quality-controlled publishing system before attempting volume. Start with a small set of carefully chosen, well-researched topics; learn from reader needs and product performance; then expand the catalogue systematically.


## International market and storefront artefacts

- Static storefront homepage prototype: `storefront-prototype/index.html` (non-production; no checkout, analytics or customer-data collection)
- International storefront specification: `INTERNATIONAL-STOREFRONT-SPECIFICATION.md`
- International go-to-market playbook: `GO-TO-MARKET-PLAYBOOK.md`
- Reusable product-page content template: `PRODUCT-PAGE-TEMPLATE.md`
- Reusable marketing campaign template: `MARKETING-CAMPAIGN-TEMPLATE.md`

These documents define the proposed customer experience, brand and trust requirements, product presentation, acquisition channels, launch sequence and measurement approach. They are planning and implementation specifications, not approval to launch publicly, process live payments, or incur costs. Final brand identity and all commercial commitments remain subject to the owner's approval.

## On-demand generation

The initial 25-topic queue is not a restriction. The platform is being designed to accept a new topic brief at any time, define audience/outcome/language/jurisdiction, assess risk, and route it through research, original drafting, review and PDF production. See `ON-DEMAND-GENERATION-ENGINE.md` for the pipeline and release controls. The deterministic request/risk/review-gate core and an authenticated customer request API adapter are implemented. The API requires an existing active customer bearer session and is disabled unless the server-side TOPIC_PDF_REQUESTS_ENABLED flag is explicitly set to true. Its D1 migration is prepared but not applied. Live model/research execution, background job processing, PDF generation for customer jobs, payments and delivery are not yet operational.

## On-demand execution and review services

The Worker now has a scheduled, D1-backed generation processor and owner-only editorial review endpoints:
- `src/topic-pdf-generation-worker.ts` — bounded job claiming, lease recovery, configured research adapter, IZAKHONO SUPER AI manuscript drafting, source-ledger validation, retry limits and human-review queue.
- `src/topic-pdf-generation-worker.test.ts` — disabled-by-default, provider-configuration, empty-queue and owner-auth guard tests.
- `/api/owner/topic-pdfs/review-queue` — owner-only editorial queue.
- `/api/owner/topic-pdfs/requests/:id/review` — records reviewer identity/role, gate decisions and specialist credentials for high-stakes guides.
- Worker cron: every five minutes; at most one generation job is claimed per tick.
- Customer request idempotency keys are persisted and unique per customer.

The processor is fail-closed. It does nothing unless `TOPIC_PDF_PIPELINE_ENABLED=true` and the research adapter plus existing IZAKHONO SUPER AI URL/internal/workflow credentials are configured. Research adapter contract: POST to `TOPIC_PDF_RESEARCH_URL` with a bearer `TOPIC_PDF_RESEARCH_KEY`; return JSON containing 2-30 current HTTPS sources with title, publisher, URL and claim support. The worker then requests a structured original manuscript from the configured IZAKHONO SUPER AI `/api/v1/generate` endpoint. The generated result is always an unapproved editorial draft.

Database migrations `0032`, `0033` and `0034` are prepared but have not been applied. No provider credentials have been configured here, no research service has been verified, no paid service has been activated, and the cron pipeline remains disabled by default. Customer sign-up/session issuance, customer-facing request/status UI, a production PDF rendering endpoint, private object storage, secure download fulfilment, payment checkout and end-to-end production verification remain outstanding. Do not represent the product as live or saleable.

## Current build artefacts

- On-demand generation pipeline: `ON-DEMAND-GENERATION-ENGINE.md`
- Generation request/risk/release-gate core: `src/generation-core.ts` and `src/generation-core.test.ts`
- Authenticated customer request API adapter: `../../src/topic-pdf-request-api.ts` and guard tests: `../../src/topic-pdf-request-api.test.ts` (disabled by default; requires migration and explicit feature activation)
- D1 generation job/event/publication schema: `../../migrations/0032_topic_pdf_generation_jobs.sql`, execution/review fields: `../../migrations/0033_topic_pdf_job_execution_and_reviews.sql`, idempotency/specialist evidence: `../../migrations/0034_topic_pdf_idempotency_and_specialist_evidence.sql`
- Candidate discovery queue: `INITIAL-TOPIC-QUEUE.md` and `topics.candidates.json`
- Product metadata contract: `product-record.schema.json`
- Catalogue validator: `validate-catalog.mjs`
- Reusable ReportLab proof renderer: `render-pdf.py` (stamps every page EDITORIAL DRAFT — NOT FOR SALE)
- Reusable manuscript template: `TOPIC-GUIDE-MANUSCRIPT-TEMPLATE.md`
- Storefront prototype validator: `validate-storefront.mjs`
- Release checklist: `RELEASE-CHECKLIST.md`
- First product record: `products/TPDF-001-household-budget.json`
- First editorial draft: `drafts/TPDF-001-household-budget.md`

The first guide is a South African editorial draft. Its rights review and editorial review are pending; it is not yet a finished PDF or approved for sale.
