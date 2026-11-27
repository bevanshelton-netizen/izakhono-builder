# IZAKHONO PUBLISHER & MEDIA MARKETPLACE
## Product, operating and technical architecture — V1

**Status:** Proposed architecture / documentation-only  
**Product family:** IZAKHONO PUBLISHING NETWORK  
**Module:** Publisher & Media Marketplace  
**Version:** 1.0  
**Release posture:** Not implemented or production-enabled by this specification

## 1. Purpose and product boundary

The Publisher & Media Marketplace is the publisher-discovery, editorial-partnership, sponsored-content and digital-PR division of IZAKHONO PUBLISHING NETWORK. It connects businesses, authors, agencies and organisations with independently operated publishers, journalists and specialist media outlets.

It is an IZAKHONO-owned marketplace and workflow product, not a copied version of a competitor's website, publisher database, brand, testimonials, pricing, content or proprietary materials.

The module complements, but does not replace:
- IZAKHONO PUBLISHING NETWORK's book, ebook, print and audiobook lifecycle;
- IZAKHONO CREATOR's canonical creative-production graph and media asset workflows;
- IZAKHONO SUPER SEO's search-intelligence and opportunity-planning capabilities;
- IZAKHONO CRM as the canonical contact, organisation, opportunity and activity system;
- IZAKHONO PAY as the canonical payment and financial transaction authority;
- FORTRESS as the identity, permission, secret, policy and audit authority;
- IZAKHONO HOST / Runtime Fabric as the governed execution and hosting layer.

The marketplace owns its domain-specific publisher, offer, campaign, placement and verification records. It must not create parallel identity, CRM, payment, audit, general file-storage or infrastructure authorities.

## 2. Product principles

1. **Publisher choice and editorial independence.** Customers can discover and request opportunities; publishers retain final editorial control and may reject submissions.
2. **Truthful quality claims.** No publisher, metric, traffic estimate, audience, placement, ranking outcome or delivery time is represented as verified without dated evidence and a defined method.
3. **No metric laundering.** Moz DA, Ahrefs DR, Semrush metrics and similar third-party scores are indicators, not proof of readership, quality, legitimacy or ranking benefit.
4. **No ranking guarantees.** Never promise rankings, traffic, leads, revenue or a specific search-engine outcome.
5. **Disclosure and search-policy compliance.** Paid or compensated placements must be clearly disclosed to readers and use appropriate link qualification, including `rel="sponsored"` or `rel="nofollow"` where applicable. Do not sell undisclosed paid dofollow links or operate link schemes intended to manipulate search rankings.
6. **Human editorial decisions.** AI may assist research, drafting, translation and workflow administration; it cannot impersonate a journalist, fabricate editorial endorsement, or override a publisher's decision.
7. **Author/customer rights.** Obtain documented licences and permissions for text, images, quotations, trademarks, data, translations, audio and other supplied materials. No blanket transfer of customer IP.
8. **Evidence before completion.** An order is not a placement; a submission is not acceptance; acceptance is not publication; a reported URL is not independently verified until checked.
9. **Privacy and minimisation.** Collect only information required for the campaign. Apply POPIA and other applicable privacy obligations, purpose limitation, retention controls and data-subject workflows.
10. **Owned-first and reversible.** IZAKHONO owns its source, domain records and canonical workflow. External publishers, metrics providers, payment rails and distribution channels are replaceable adapters.

## 3. Actors and permissions

All roles are tenant-scoped and resource-scoped through FORTRESS. A role label supplied by a browser is never authority.

| Actor | Permitted domain actions |
|---|---|
| Customer / brand owner | Create organisation profile, briefs, campaigns; choose offers; approve content and spend; view reports |
| Author / rights holder | Supply work, grant scoped licences, approve edits and publication proofs |
| Agency operator | Manage explicitly delegated client campaigns and reports within assigned tenant/client scope |
| Publisher owner | Manage publisher profile, inventory, offers, editorial requirements and payment details through approved flows |
| Publisher editor | Review pitches and drafts, request revisions, accept/reject and record editorial decision |
| Writer / editor | Work only on assigned content; submit drafts and revision notes |
| Outreach specialist | Contact approved publisher contacts using permitted channels and logged consent/legal basis |
| Campaign manager | Coordinate milestones, deadlines, disputes and customer communications |
| Quality reviewer | Verify listing evidence, content integrity, disclosure, publication URL and placement checks |
| Finance operator | View authorised quotes, invoices, payment status and reconciliations through PAY |
| Marketplace administrator | Moderate listings and resolve operational issues; no implicit cross-tenant content access |
| Auditor / compliance reviewer | Read only the exact records and evidence authorised for review |

Publisher and customer accounts are separate business parties. A person may hold multiple memberships, but each action must be evaluated against the active principal, membership, tenant, resource ownership, exact action and delegation scope.

## 4. Marketplace capabilities

### 4.1 Publisher directory

Publisher records may describe websites, digital magazines, news outlets, trade publications, professional associations and other editorial channels.

Search and filters:
- country, region, language and time zone;
- topic, industry and audience category;
- content format and editorial opportunity type;
- audience geography and audience description;
- publisher status and verification freshness;
- price range and currency;
- estimated organic traffic and its source/date;
- third-party domain metrics and their source/date;
- editorial requirements, disclosure rules and turnaround estimates;
- accessibility, content restrictions and accepted formats.

Directory listing states: `draft`, `submitted`, `under_review`, `approved`, `suspended`, `rejected`, `withdrawn`, `archived`.

A listing must not appear as approved until required identity/business checks, domain-control evidence, editorial review and quality evidence are accepted. Verification expires and must be refreshed according to risk and evidence age.

### 4.2 Publisher intelligence and verification

Each quality observation is an immutable, dated evidence item with:
- metric name and value;
- source/provider and collection method;
- observed-at timestamp and evidence reference;
- scope (domain, subdomain, URL, country or other);
- confidence/limitations and reviewer;
- expiry/recheck date where relevant.

Verification dimensions:
- domain ownership/control and publisher identity;
- publication history, original editorial content and topical fit;
- audience and traffic evidence, including trend and geography where available;
- outbound-link patterns, advertising density and suspicious link networks;
- redirects, malware/reputation flags and domain-history anomalies;
- editorial policy, author identity, correction policy and sponsored-content disclosure;
- legal/business eligibility and prohibited-content screening.

A listing's overall state is not a single opaque score. Show the component evidence and freshness. A manual reviewer may suspend a listing immediately when credible risk is identified. A publisher may appeal with new evidence.

### 4.3 Offers and pricing

A publisher may create one or more offers with:
- offer type (sponsored article, contributed article, interview, product feature, newsletter placement, press release, display sponsorship or other approved format);
- scope, word-count range and included assets;
- link policy and disclosure requirements;
- publication location and expected permanence/retention terms;
- price, currency, taxes and any third-party costs;
- revision limits, cancellation/refund/replacement terms;
- estimated lead time, clearly labelled as an estimate;
- availability and expiry;
- publisher acceptance criteria.

Prices are publisher/customer commercial terms, not an implied endorsement or guaranteed SEO result. Quotes must disclose IZAKHONO service fees, publisher fees, taxes, payment fees and any other deductions separately.

### 4.4 Briefing, content and editorial production

Campaign brief fields:
- objective and intended audience;
- brand/organisation and approved claims;
- topic, angle, keywords and target market;
- destination URLs and proposed link context;
- required disclosures and prohibited claims;
- supplied article or commissioned writing;
- source citations and factual substantiation;
- image, logo, quotation and data permissions;
- language, tone and word-count requirements;
- deadline and budget approval.

Content stages: `brief_draft` → `brief_approved` → `drafting` → `internal_review` → `customer_review` → `revision_requested` (repeat within scope) → `customer_approved` → `publisher_submitted` → `publisher_review` → `publisher_accepted` or `publisher_rejected` → `scheduled` → `published`.

Each version is immutable and content-addressed. Approval is bound to an exact version/hash, approver, scope and timestamp. A later edit invalidates approval for the changed version. Publisher editorial changes after customer approval require a new customer review where they materially alter claims, links, disclosures, rights or meaning.

### 4.5 Human-led outreach and digital PR

Outreach work supports:
- tailored pitches and expert-contribution requests;
- journalist and editor relationship records;
- interviews, commentary, contributed expertise and press enquiries;
- media-list segmentation and campaign sequencing;
- follow-up scheduling and opt-out/suppression controls;
- response tracking and relationship history.

No bulk unsolicited automation, deceptive identity, fake journalist personas, fabricated quotes, guaranteed coverage or purchased editorial endorsement. Outreach must comply with applicable marketing/privacy law, publisher terms and recipient preferences. Respect opt-outs and suppression records across campaigns.

### 4.6 Publication evidence and monitoring

A placement record may only enter `published_reported` when a publisher or operator supplies a live URL and publication evidence. It enters `verified_live` only after the system/reviewer verifies:
- URL resolves and canonical destination is recorded;
- page belongs to the approved publisher/domain;
- content matches the approved or explicitly re-approved version;
- disclosure is present where required;
- link destination and link attributes are recorded accurately;
- publication date and relevant metadata are captured;
- no unexpected redirects, malware or material content substitution is detected.

Ongoing checks record `live`, `changed`, `missing`, `blocked`, `redirected` or `unknown`, with check time and evidence. Monitoring failures must not be misreported as confirmed deletion. Replacement/refund policy follows the accepted offer and contract; there is no universal guarantee of permanent placement unless expressly contracted and legally supportable.

### 4.7 Agency and white-label workspace

Agency tenants may:
- create and manage client workspaces under explicit delegation;
- assign client users and internal staff;
- create campaign briefs and request quotes;
- access approved wholesale rates;
- issue client-facing reports under their own brand where licensed;
- reconcile agency/client billing records.

White-labeling changes presentation only. It does not conceal the actual publisher, misstate the source of editorial content, remove required sponsorship disclosures, or bypass audit, rights, payment, privacy or security controls. Agency access is restricted to assigned clients and campaigns.

### 4.8 Affiliate and referral programme

Partner referral tracking must disclose:
- partner identity and referral terms;
- commission basis, attribution window and exclusions;
- validation, cancellation, refund and clawback rules;
- payout threshold, currency, tax and payment timing;
- prohibited promotion methods and self-referral rules.

Commissions are calculated from reconciled eligible transactions, not merely clicks or unconfirmed orders. PAY remains financial authority.

## 5. End-to-end campaign lifecycle

Canonical campaign state:
`draft` → `submitted` → `qualification` → `quoted` → `awaiting_customer_approval` → `approved` → `awaiting_payment` → `funded` → `production` → `customer_content_review` → `publisher_submission` → `publisher_decision` → `scheduled` → `published_reported` → `verification` → `verified_live` → `monitoring` → `closed`.

Exception states: `revision_required`, `publisher_rejected`, `customer_cancelled`, `refund_pending`, `refunded`, `replacement_pending`, `disputed`, `blocked_compliance`, `failed`.

Rules:
- Every transition has an actor, timestamp, reason, prior state and evidence reference.
- A transition is idempotent under a tenant-scoped operation key.
- Customer approval and payment are separate gates.
- Payment confirmation is obtained from PAY; a browser callback or uploaded receipt alone is not payment authority.
- No content is sent to a publisher before required rights, disclosure, customer approval and payment/credit conditions pass.
- Publisher rejection is not silently converted to completion.
- A timeout or unavailable external system is `unknown/pending`, not success or failure without reconciliation.
- Refunds, replacements and disputes are explicit workflows with contract-based outcomes.
- Public reporting must distinguish planned, ordered, submitted, accepted, reported-live and verified-live.

## 6. Core domain data model

The following is a logical domain model, not a database migration.

| Entity | Purpose / key relationships |
|---|---|
| MarketplaceTenant | Customer, publisher or agency tenant boundary; references canonical platform/entity identity |
| PublisherProfile | Publisher identity, domains, editorial profile, verification state |
| PublisherDomain | Domain, ownership evidence, canonical host, status and history |
| PublisherMetricEvidence | Immutable dated metric observations and evidence references |
| PublisherVerification | Review decision, dimensions, reviewer and expiry |
| PublisherOffer | Publisher-owned commercial offer, scope, terms and availability |
| Campaign | Customer brief, objective, owner tenant, budget and lifecycle |
| CampaignTarget | Selected publisher/offer and immutable quote snapshot |
| Quote | Line items, fees, taxes, currency, expiry and approval state |
| ContentAsset | Exact version, hash, format, language, licence and provenance |
| ContentApproval | Approval bound to exact content hash and purpose |
| OutreachActivity | Recipient, channel, lawful basis, message version, outcome and opt-out |
| Submission | Publisher submission, timestamps, package hash and decision |
| Placement | Live URL, publisher, campaign target, link/disclosure metadata |
| PlacementCheck | Time-stamped status and evidence for a placement |
| ContractReference | External/canonical agreement reference, version and acceptance evidence |
| PaymentReference | PAY transaction/invoice identifiers; no parallel payment ledger |
| AgencyDelegation | Exact client, action, duration and delegated principal scope |
| AffiliateAttribution | Referral source, attribution window and eligibility state |
| DisputeCase | Issue, evidence, owner, resolution and financial consequence reference |
| AuditReference | FORTRESS audit event reference; marketplace does not become audit authority |

Every tenant-owned record includes a stable internal ID, tenant/platform scope, creation/update timestamps and version. Cross-tenant references are prohibited unless a separately authorised, exact-scope relationship exists.

## 7. Integration contracts and ownership

| System | Integration responsibility | Boundary |
|---|---|---|
| FORTRESS | Authenticate principal; resolve membership, permissions, delegation, policy and audit | Sole security/identity authority |
| CRM | Organisations, contacts, opportunities and relationship activities | Marketplace stores canonical CRM references, not duplicate CRM masters |
| PAY | Quotes/invoice/payment/refund/payout references and reconciliation | No local payment truth or client-supplied paid flag |
| CREATOR | Content briefs, assigned production, versions, assets and provenance | Reuse existing graph and rights/consent model where suitable |
| SUPER SEO | Keyword/topic research and opportunity suggestions | Research is advisory; no automatic publisher selection or ranking promise |
| PUBLISHING NETWORK | Book/article/audiobook editorial and distribution handoffs | Shared author/content identity through explicit domain contracts |
| HOST / Runtime Fabric | Governed execution, scheduling, storage and monitoring workers | No arbitrary browser-supplied provider or infrastructure target |
| External metric providers | Domain/traffic metric observations | Adapter data is attributed, dated and replaceable |
| External publishers | Pitches, submission and placement status | Publisher remains final editorial authority |
| Email/communications | Approved outreach and transactional notices | Credentials server-side; consent, rate and opt-out enforcement |

All integration adapters must define authentication, request/response schemas, idempotency, timeout, retry, reconciliation, data minimisation, error classification and evidence retention. A configured adapter is not considered connected until an end-to-end test and operational owner acceptance have passed.

## 8. Security, privacy, rights and compliance

- Enforce FORTRESS entity/platform isolation on every read, write, search, export, background task and webhook.
- Never trust caller-supplied tenant IDs, role names, ownership claims, approval booleans or payment state.
- Use least-privilege service identities and short-lived, exact-scope delegation.
- Store provider credentials only in approved server-side secret management.
- Validate webhooks, signatures, replay windows, origin and idempotency.
- Treat publisher URLs and submitted documents as untrusted input; protect fetchers against SSRF, private-network access, redirects to prohibited destinations, malware and oversized payloads.
- Apply content-security checks, malware scanning and safe file handling before processing.
- Record rights/consent for text, images, video, audio, data, trademarks, quotations and translations. Do not publish disputed or unlicensed material.
- Keep author/customer IP ownership intact; grant only a documented, limited licence necessary to perform the selected service.
- Provide retention, export, correction, deletion and legal-hold handling consistent with applicable law and contracts.
- Do not expose private customer briefs, draft manuscripts, publisher contacts or unpublished content to other tenants or model providers without a lawful basis and explicit configuration.
- AI-generated content requires human factual, editorial, rights and disclosure review. Do not fabricate sources, credentials, endorsements, reviews or audience metrics.
- High-risk or prohibited categories require policy review and may be declined.

## 9. Commercial model

Potential revenue lines:
- publisher placement coordination fee;
- content writing, editing, translation and localisation;
- digital PR and managed outreach;
- sponsored content production;
- campaign management;
- agency wholesale and white-label subscription;
- publisher premium tools/listing subscription;
- enterprise contracts;
- affiliate/referral commissions.

Pricing is configured by currency and market. Quotes itemise publisher cost, IZAKHONO service fee, taxes, payment fees and other deductions. No competitor pricing is adopted by this architecture. No Black Friday discount, package price, inventory count or service-level promise is authorised here.

## 10. Operational dashboards

Customer dashboard: campaigns, quote approvals, spend, content versions, decisions, live URLs, verification state, monitoring and reports.

Publisher dashboard: profile health, verification requests, offers, submissions, editorial decisions, scheduling, payment references and dispute records.

Agency dashboard: client portfolio, delegated access, campaign queues, wholesale quotes, branded reports and reconciliation.

Operations dashboard: listing reviews, evidence expiry, campaign exceptions, outreach suppression, placement checks, disputes, adapter health and audit references.

All dashboards display the source and freshness of third-party metrics. Unknown or stale data is visibly labelled.

## 11. Delivery phases and gates

**Phase 0 — Architecture (this deliverable):** product boundary, actor model, lifecycle, logical data model, integration ownership, quality and security rules.

**Phase 1 — Domain contracts:** strict schemas for publisher profiles, evidence, offers, campaigns, content approvals, placements and verification; deterministic validation fixtures; FORTRESS access-context integration design.

**Phase 2 — Internal operations prototype:** private publisher onboarding, manual verification queue, campaign planning and evidence capture using synthetic fixtures. No public listings or real customer transactions.

**Phase 3 — Controlled marketplace pilot:** owner-approved publisher cohort, legal terms, privacy assessment, support process, payment integration and operational runbooks. Real publisher/customer onboarding only after acceptance.

**Phase 4 — Agency and commercial expansion:** agency delegation, white-label reports, affiliate reconciliation, multi-currency pricing and publisher subscriptions.

**Phase 5 — International scale:** multilingual listings, regional publisher operations, local legal review, additional verified metric adapters and resilient monitoring.

Each phase requires its own review, acceptance evidence and release approval. Passing a schema test does not establish production readiness.

## 12. Acceptance criteria

Architecture is acceptable when:
- publisher, customer and agency boundaries are explicit and non-overlapping by default;
- no duplicate identity, CRM, payment, audit or general asset authority is introduced;
- publisher quality claims are evidence-backed, dated and attributable;
- paid placements are disclosed and link qualification is accurately recorded;
- content approvals bind to immutable versions and hashes;
- rights and permissions are required before submission/publication;
- lifecycle transitions are auditable, idempotent and fail closed;
- publisher rejection, refund, replacement and dispute states are represented;
- reported-live and verified-live are distinct;
- monitoring distinguishes missing, blocked and unknown states;
- agency delegation is exact-scope, time-bounded and revocable;
- AI assistance cannot impersonate an editor or invent evidence;
- customer exports and reports preserve tenant isolation and source provenance;
- all external adapters have explicit connection and operational acceptance gates.

## 13. Explicit exclusions and no-cost boundary

This document does not create application code, database tables, migrations, secrets, provider accounts, publisher inventory, customer accounts, payment routes, external integrations, public listings, contracts, campaigns or production deployments.

No hosting, infrastructure, subscription, API usage, paid publisher placement, advertising, outreach campaign or other expenditure is authorised. No external publisher count, traffic figure, metric or customer outcome is claimed.

The public marketplace remains disabled until a separate owner-approved implementation, legal review, security review, operational acceptance and deployment decision are complete.

## 14. Decisions intentionally left open

The following require evidence and accountable owner approval before implementation:
- initial country and publisher-category pilot;
- publisher verification evidence thresholds and refresh intervals;
- prohibited/restricted industry policy;
- pricing, taxes, refund/replacement and publisher payout terms;
- lawful basis and channel policy for outreach by jurisdiction;
- source/provider selection for third-party traffic and domain metrics;
- retention periods and legal-hold policy;
- content moderation and appeals ownership;
- payment and payout rails, currencies and settlement model;
- initial support coverage and service-level commitments.

No default decision may silently turn these unresolved items into customer-facing promises.


## 15. Persistence adapter and mutation boundary contracts

The executable persistence-boundary contracts define the minimum envelope expected of a future storage adapter. They are conformance rules, not a database implementation or a replacement for FORTRESS.

- Every record and idempotency receipt is scoped to both the canonical platform and entity identifiers. A mismatched scope is rejected before a storage adapter returns or mutates a record.
- Every write carries a FORTRESS authorization decision reference, principal reference, exact permission, policy version and decision timestamp. The adapter must obtain that decision from FORTRESS for the current principal, tenant, resource and action; validating a supplied reference is not authorization.
- Writes carry an expected record version. A stale writer receives a conflict rather than silently overwriting a newer version.
- Idempotency is scoped to tenant, operation and key. The same key and request fingerprint replays the original result; reusing the key with a different operation or fingerprint conflicts.
- Approval records bind the exact content asset and SHA-256 content hash to the approving principal, FORTRESS decision, purpose, timestamp and audit reference. Corrections are represented by a superseding approval; historical approval evidence is not edited in place.
- Audit events identify tenant, principal, authorization decision, action, subject, version boundary, timestamp and correlation reference. The eventual store must be append-only for these events.
- Creation and update timestamps are not substitutes for audit evidence. A mutation must carry an audit-event reference and commit the record change and audit evidence atomically, or use a documented recoverable outbox protocol.

No database engine, migration, authentication middleware, runtime endpoint or adapter is selected by these contracts. Before persistence implementation, inspect and reuse the canonical DATABASE and FORTRESS integration patterns, establish transactional audit semantics, and obtain architecture/security review. PAY remains authoritative for payment state; no local payment ledger is introduced.


## 16. Identity integration discovery — implementation gate

Repository inspection identified an important boundary that must remain explicit:

- The currently inspected `products/fortress-security/src/types.ts`, `policy.ts` and `control-plane.ts` implement defensive security-scan scope validation and findings/control-plane reporting. They do not establish a tenant identity, membership, delegation or application authorization API for this marketplace.
- The existing `src/customer-auth.ts` implements Builder-specific customer password/session operations against a `CustomerAuthDB`. It is not evidence of a canonical FORTRESS principal, tenant-membership or fine-grained authorization service.
- Therefore, neither implementation is to be silently repurposed as the marketplace's FORTRESS integration. In particular, the defensive scan environment flag is not an application authorization decision.

Before any customer/publisher portal, API or database adapter is implemented, the owner and architecture reviewers must identify the actual canonical FORTRESS identity/authorization service, its supported interface and decision/audit contract, and the approved DATABASE persistence boundary. Until those are verified, marketplace authorization remains an explicit integration dependency and all code remains pure conformance logic.


### FORTRESS repository cross-check

A cross-repository check of `bevanshelton-netizen/SHELTON-FORTRESS` confirms that FORTRESS IDENTITY GUARD currently describes an explainable identity-risk layer around authentication performed by an authorised upstream system. Its documented `POST /api/v1/identity/risk` and `GET /api/v1/identity/events` interfaces assess and expose risk decisions; the documentation explicitly assumes banks already authenticate their customers and employees.

For this marketplace, those risk interfaces may become a supplementary FORTRESS signal after their service authentication, tenant scope and data contract are verified. They must not be mistaken for a complete marketplace login, session, membership, role, delegation or per-resource authorization API. The FORTRESS product remains the intended canonical authority in the IZAKHONO architecture; the current implementation gap is to locate or define its approved application access-control interface, not to substitute another identity system.


## 17. Publisher onboarding and verification workflow

The first operational workflow is now defined as a pure, testable state machine. It does not create accounts, contact publishers, resolve DNS, fetch websites or persist evidence.

### Lifecycle
`draft → submitted → identity_review → domain_verification → editorial_review → approved → listed`

Review may reject a submission. Approved/listed publishers may be suspended or expired; suspended/expired profiles can re-enter review. There is no direct transition from a submitted or review-stage publisher to public listing.

### Evidence gates before approval
- Legal identity evidence, with source and evidence reference.
- Authorised representative evidence tied to a principal reference.
- Exact primary-domain control evidence.
- Editorial policy evidence and explicit publisher acceptance.
- Confirmation that the publisher retains final editorial control.
- Acceptance of the paid-content disclosure policy.
- Reviewer principal and FORTRESS authorization-decision provenance for verified evidence.

Evidence records carry observation time, optional expiry, verifier principal, authorization-decision reference and status. Missing, stale or unprovenanced evidence cannot satisfy approval gates. Domain normalization rejects URLs, paths and wildcard primary domains; a future DNS/HTTP challenge adapter must prove control of the normalized exact domain before recording verified evidence.

### Metrics and publisher claims
Traffic/audience metrics are separate evidence types. They require a source, reference, observation date and freshness expiry. Undated, future-dated or stale metrics are rejected by the contract. Metrics are descriptive evidence, not ranking promises, and must retain provider/source scope and limitations in the eventual presentation.

### Authorization and integration boundary
Every state transition requires a principal reference, FORTRESS authorization-decision reference and the permission appropriate to the action. This contract validates those fields; a future service must obtain the decision from the approved FORTRESS access-control interface for the current actor, tenant and publisher resource. No browser-supplied permission or self-asserted verification status is authoritative.

### Implementation boundary
No public publisher registration form, login, email verification, DNS challenge, external analytics connection, document upload, moderation console, database migration or public directory has been activated. Those require the canonical FORTRESS application authorization interface, approved DATABASE adapter, secure evidence storage, privacy/legal review and operational ownership. The current onboarding state machine and tests are the conformance specification for that implementation.


## 18. Private publisher review queue contract

The private review queue is the next deterministic operations layer. It is not a portal, account system, evidence vault or live moderation service.

- Each review case is scoped to the canonical platform and entity, references one publisher, has an optimistic version, an optional due date and an explicitly assigned reviewer principal.
- Review states are `open`, `in_review`, `awaiting_evidence`, `approved`, `rejected` and `closed`. State changes require a current FORTRESS decision reference, policy version, exact action permission, reason code, timestamp and expected version.
- Evidence requests have their own lifecycle: `requested` → `submitted` → `accepted` or `rejected`; expired/rejected requests may be resubmitted only through the defined transition. Approval is blocked while any requested evidence is not accepted.
- Evidence payloads are opaque references only. Raw identity documents, personal data, credentials and uploaded files must be held only by a future approved secure evidence-storage service; reviewer notes are references, not free-form personal-data fields.
- Review decisions are immutable records with the case version, actor, FORTRESS decision, reason, evidence-request references, audit-event reference and timestamp. Corrections require a superseding decision, not editing history.
- These functions validate conformance data only. They do not assign a real reviewer, call FORTRESS, verify a document, store evidence, notify a publisher or approve/list a publisher in production.


## 19. Review service and integration boundary verification

A provider-neutral application service now orchestrates private review reads and decisions through explicit ports:

- The authorization port receives the authenticated principal, tenant scope, exact review resource and action permission. Authorization is checked before the case is read, so denied callers cannot use the review endpoint to enumerate case existence.
- The service validates the returned authorization decision against the requesting principal, requested permission, policy version and decision timestamp. Caller-supplied permission strings are never treated as proof of authority.
- The persistence port is required to atomically compare the expected version and commit the updated case, immutable decision, append-only audit event and idempotency receipt. A version race returns a conflict; a repeated idempotency key must replay the original result.
- Reads and returned commit records are checked against the requested tenant scope. Cross-tenant cases are returned as not found.
- The service is dependency-injected and has deterministic tests for authorization-first ordering, principal mismatch, exact permissions, tenant isolation and optimistic concurrency.

### Verified FORTRESS / ID / DATABASE findings

- FORTRESS's apps/izakhono-one/service-contracts.json names an ID service with tenant.create, user.create, role.assign, session.issue and session.revoke operations. This remains a capability catalogue, not the executable API for those operations.
- The repository does contain a distinct IZAKHONO ID service at products/izakhono-id. Its documented routes include entity/user/membership administration, entity-scoped login sessions, MFA and POST /api/v1/internal/introspect. It uses its own SQLite database and is a separate implementation from the FORTRESS session issuer. The two identity implementations must not be silently combined or treated as interchangeable; the owner must confirm which identity authority is canonical for marketplace publishers and staff.
- FORTRESS's persistent session issuer is products/fortress-identity. Its documented GET /api/fortress/session endpoint verifies a signed access token against the live D1 session registry and returns a verified principal, tenant and role. The Creator integration contract demonstrates the intended service-binding pattern and requires fail-closed behaviour. This provides a concrete authentication/session-verification boundary for a future marketplace adapter, but the issuer remains deployment-gated and currently supports only one-time owner bootstrap; multi-user invitations and administrative role management are not yet implemented.
- FORTRESS's products/fortress-security/src/access-control.ts is a deterministic role/tenant policy library, not a remote authorization-decision service. The marketplace change adds least-privilege publishing permissions: OWNER and SECURITY_ADMIN may manage and approve reviews/listings; ANALYST may read and request evidence but cannot approve or list; VIEWER is read-only. Its authorize() function does not itself issue a durable decision reference or append an audit event, so the application AuthorizationPort remains unbound until that decision/audit boundary is supplied.
- FORTRESS apps/api/app/main.py includes separate local user authentication and risk services for the FORTRESS product. IDENTITY GUARD and partner API scopes remain risk-assessment interfaces, not the marketplace's resource authorization service.
- The FORTRESS API uses SQLAlchemy with PostgreSQL DATABASE_URL and Alembic migrations for its own service database. It is not the marketplace's approved shared DATABASE service.
- Builder's wrangler.jsonc declares a Cloudflare D1 binding named DB, and src/internal-repository.ts uses it for Builder project/repository records. That is a Builder-owned persistence boundary, not proof that D1 is the canonical IZAKHONO DATABASE service or approved for marketplace records.
- Repository discovery did not identify a separate installed repository explicitly providing the canonical IZAKHONO DATABASE service. No marketplace migration or production persistence adapter is therefore added.

### Composition and activation gate

The review service now requires a live session verified by an injected FORTRESS identity-session verifier, then a separate resource/action authorization decision. Its production session adapter can follow Creator's documented FORTRESS_IDENTITY service-binding pattern, but no binding or issuer deployment is configured for this marketplace. The AuthorizationPort remains unbound because the current FORTRESS policy library does not issue durable authorization-decision/audit receipts. The owner must also confirm the canonical staff/publisher identity authority where IZAKHONO ID and FORTRESS Identity overlap. The persistence port remains unbound until the canonical DATABASE adapter is identified. Nothing is wired to FORTRESS's local product login, the identity-risk endpoint, partner risk scopes, or Builder's D1 database. No credentials, external service connections, migrations, document storage or public review portal are created by this change.


### FORTRESS session and role contract correction (source verified)

A direct inspection of FORTRESS `apps/api/app/main.py`, `apps/api/app/models.py` and `apps/api/app/schemas.py` confirms the current product API exposes `POST /api/v1/auth/login` with a `TokenResponse` containing access and refresh tokens. Its `current_user` dependency validates the bearer access token and loads an active user. The product role model is `owner`, `administrator`, `technician`, `auditor`, `viewer`, with a product-specific role hierarchy. The inspected API does **not** expose the previously assumed `GET /api/fortress/session` endpoint, nor a verified publishing resource-permission decision endpoint. The review service therefore uses an abstract, fail-closed session-verifier port and a separate authorization-decision port; neither is wired to a guessed route. The TypeScript role labels now match the verified FORTRESS product role names. These existing product roles are context only and do not independently authorize publishing actions.

The private review service now supports an authenticated, tenant-scoped evidence-request operation. It checks session and action authorization before case lookup, verifies the expected case version, adds an evidence request with a deadline, transitions the case to `awaiting_evidence`, and atomically requests persistence of the case update, immutable decision, audit event and idempotency receipt. Its request fingerprint includes the evidence kind, request ID and deadline, preventing a reused idempotency key from silently changing the requested evidence. This remains a port-driven contract and test harness, not a live FORTRESS or DATABASE adapter.


### Idempotency and retry safety

The application service now resolves a tenant-scoped idempotency receipt only after authenticating the session and receiving the current action authorization decision, but before checking the case's current version. An identical retry returns the original immutable result even though the successful first request advanced the case version. Reusing the same key with a different request fingerprint fails closed. The persistence adapter must enforce the same rule atomically inside `commitMutation` to close concurrent-request races; the in-memory fake demonstrates the expected contract only and is not a production persistence implementation.
