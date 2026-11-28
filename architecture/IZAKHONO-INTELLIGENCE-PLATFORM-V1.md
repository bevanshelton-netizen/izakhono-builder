# IZAKHONO Intelligence Platform — Architecture v1

**Status:** Documentation architecture proposal  
**Scope:** IZAKHONO SIGNAL, IZAKHONO EXPERIENCE, GEO and governed intelligence-to-action  
**Delivery posture:** Documentation-only; no production activation or paid-provider commitment  
**Architecture authority:** FORTRESS security and governance; existing NODE01 identity standard remains mandatory

## 1. Purpose

Establish a coherent, extensible intelligence platform that helps organisations understand external markets, search demand, AI-generated brand representation, customer and stakeholder experience, and operational outcomes. The platform must convert verified observations into explainable recommendations and, where authorised, accountable actions.

The platform draws architectural inspiration from:
- Search-intent and AI-answer intelligence: demand discovery, multi-market monitoring, source analysis, trend and reputation detection.
- Generative Engine Optimization (GEO): technical and factual discoverability, entity clarity, structured content, citation quality and AI visibility measurement.
- Experience-management systems: NPS, CSAT, CES, journey-triggered surveys, sentiment analysis, detractor escalation and closed-loop resolution.

These are capability references, not claims that IZAKHONO already has equivalent datasets, provider licences, integrations, certifications, scale or performance.

## 2. Product boundaries

### 2.1 IZAKHONO SIGNAL — external intelligence

SIGNAL observes and analyses lawful, licensed or otherwise authorised external information:
- Search demand and audience questions.
- Search, retail, social, media and other permitted source signals.
- AI answers, brand mentions, recommendations and cited sources.
- Competitor positioning and category movement.
- Market, geographic and language differences.
- Reputation signals and emerging narratives.
- Opportunity and threat indicators.

### 2.2 SIGNAL GEO — discoverability and entity optimisation

GEO is a capability within SIGNAL, not a promise of AI placement. It:
- Audits public technical discoverability and crawl accessibility.
- Maintains verified organisation, brand, product and service facts.
- Generates and validates appropriate structured data.
- Identifies gaps in authoritative, useful, answer-oriented content.
- Audits public directory and citation consistency.
- Measures observed AI answers and citations under recorded test conditions.
- Recommends factual corrections and content improvements.

GEO must never guarantee indexing, citation, ranking or recommendation by any search engine or AI system. Schema markup and optional files such as `llms.txt` are aids to clarity, not guaranteed ranking mechanisms.

### 2.3 IZAKHONO EXPERIENCE — first-party experience intelligence

EXPERIENCE captures feedback from customers, employees, members, partners, suppliers and beneficiaries under appropriate privacy and employment safeguards:
- NPS, CSAT and CES.
- Surveys and feedback forms across permitted channels.
- Journey and event-triggered feedback.
- Qualitative comments, themes and sentiment.
- Service quality, effort, complaint and resolution measures.
- Closed-loop cases, ownership, escalation and follow-up.
- Longitudinal experience trends and outcome measurement.

SIGNAL and EXPERIENCE remain separate bounded domains with distinct data permissions. Unified analytics may use approved, minimised and appropriately aggregated information; it must not silently merge identifiable feedback with external profiling.

## 3. Shared intelligence lifecycle

All capabilities use a common evidence lifecycle:

1. **Observe:** collect a source event or first-party response through an authorised connector or user submission.
2. **Normalise:** map it to the canonical event model while preserving original source, timestamps, locale and provenance.
3. **Validate:** check schema, source permissions, freshness, duplication and integrity.
4. **Interpret:** use deterministic analytics and AI models to classify, summarise or detect patterns.
5. **Corroborate:** compare independent evidence where available; preserve disagreements and uncertainty.
6. **Prioritise:** score significance, urgency, confidence, business relevance and potential impact.
7. **Recommend:** produce an actionable proposal with evidence, rationale, owner role and expected measurement.
8. **Authorise:** apply FORTRESS policy and human approval where required.
9. **Execute:** invoke a narrowly scoped, auditable workflow or connected system.
10. **Evaluate:** measure the outcome and feed the result into future analysis.

Observation, interpretation and action are distinct records and must never be conflated.

## 4. Agent architecture

Agents are specialised workers operating under a shared orchestration contract. Initial logical roles:

### SIGNAL agents
- Search Monitor — observes configured search-demand sources.
- Trend Detector — identifies statistically or operationally meaningful movement.
- AI Answer Monitor — runs approved prompt suites against supported AI systems.
- Source Verifier — checks citations and evidence quality.
- Competitor Watch — monitors public, permitted competitor signals.
- Reputation Guardian — identifies emerging narratives and potential reputational issues.
- GEO Auditor — checks technical, entity and content discoverability.
- Opportunity Analyst — develops evidence-backed opportunity hypotheses.
- Strategic Intelligence — ranks and explains recommendations.

### EXPERIENCE agents
- Survey Orchestrator — schedules and distributes authorised surveys.
- Feedback Classifier — categorises responses and extracts themes.
- Sentiment Analyst — estimates sentiment with confidence and context.
- Experience Risk Monitor — flags configured risk patterns without treating a score as a definitive prediction.
- Case Router — proposes or creates cases within approved workflows.
- Resolution Tracker — follows ownership, due dates and resolution states.
- Outcome Evaluator — compares follow-up experience measures.

### Agent constraints
- Agents must have explicit identities, scoped permissions, approved tools and bounded objectives.
- Agents cannot grant themselves permissions or expand their own data access.
- Model output is untrusted input until validated.
- Agents cannot fabricate citations, customer feedback, reviews, community participation or source evidence.
- No autonomous public posting, customer contact, financial commitment, employment decision, account suspension or consequential change without the applicable authorisation policy.
- Agent activity, tool calls, evidence references, approvals and outcomes must be auditable.
- Failure, timeout, low confidence or conflicting evidence must fail safely and escalate rather than invent certainty.

## 5. Canonical data model

The platform should converge on versioned, tenant-scoped records. Initial logical entities:

- **Tenant / Organisation:** customer boundary, legal entity and configuration.
- **Brand / Entity:** verified names, aliases, domains, products, services and relationships.
- **Market:** country, region, locality, language and applicable market dimensions.
- **Source Connector:** provider, source type, permissions, licence, terms, coverage and operational state.
- **Observation:** immutable source-derived event or first-party feedback record.
- **Query / Prompt:** search term, question or AI test prompt, including locale and test context.
- **AI Answer Snapshot:** captured answer, model/provider, timestamp, prompt, settings and citations where available.
- **Citation / Evidence:** source URL or source identifier, retrieval time, supporting excerpt/hash and verification status.
- **Trend:** time-bounded signal with baseline, sample size, method and confidence.
- **Survey / Question / Response:** versioned instruments and access-controlled responses.
- **Experience Metric:** NPS, CSAT, CES and other explicitly defined measures with denominator and calculation version.
- **Case / Intervention:** issue, owner, priority, status, due dates and resolution evidence.
- **Insight:** interpretation linked to source observations and model/method version.
- **Recommendation:** proposed action, rationale, expected effect, confidence and required approval.
- **Approval / Action:** policy decision, authorised actor, scope, execution record and result.
- **Outcome:** measured post-action result, attribution limits and follow-up evidence.
- **Audit Event:** append-only record of access, decisions, changes and agent activity.

All records must carry tenant scope, stable IDs, created/observed timestamps, provenance, retention classification and schema version where applicable. Personally identifiable feedback requires stricter access, minimisation, retention and deletion controls.

## 6. Measurement and analytical integrity

### Search and market intelligence
- Distinguish raw query volume, sampled observations, provider indices, estimates and model-generated interpretations.
- Record source coverage, collection cadence, sampling method and historical availability.
- Do not compare incompatible provider metrics as if they share one methodology.
- Detect anomalies using documented baselines and minimum sample thresholds.

### AI visibility
- Treat AI answers as observations under specific conditions, not a universal ranking.
- Record exact prompt, language, geography, model/provider, product mode, date/time, browsing state and available configuration.
- Measure brand presence, factual accuracy, recommendation context, competitor mentions and citations separately.
- Repeat tests to estimate variability; disclose sample sizes and uncertainty.
- Never infer that an AI answer is representative of all users or all model sessions.

### Experience measurement
- Define NPS calculation as percentage of promoters (9–10) minus percentage of detractors (0–6), on the standard 0–10 question.
- Define CSAT and CES question wording, scale direction, calculation and population for every instrument.
- A low score or negative sentiment is a triage signal, not proof of a root cause or individual fault.
- Report response rate, sample composition, non-response limitations and confidence where statistically appropriate.
- Churn-risk outputs must be calibrated and evaluated against actual outcomes before being described as predictive.

## 7. Closed-loop workflows

A standard issue workflow:

`captured → classified → triaged → assigned → acknowledged → in_progress → resolved → customer_follow_up → verified → closed`

Alternative terminal states include `duplicate`, `invalid`, `withdrawn` and `unable_to_resolve`, each with a reason and audit event.

Workflow requirements:
- Configurable severity and service-level targets.
- Named accountable owner or role at every active stage.
- Idempotent event handling and duplicate suppression.
- Escalation on missed acknowledgement or resolution deadlines.
- Customer contact only through approved channels and templates.
- Follow-up measurement after resolution.
- Recurrence analysis across related cases.
- No automatic closure solely because an agent says the issue is resolved.

## 8. Integrations and connector strategy

Use provider-neutral connector contracts. Candidate categories include:
- Search engines and webmaster/search performance services.
- Retail and marketplace search where access is licensed.
- Social and video platforms through permitted APIs or licensed feeds.
- AI model providers and approved answer-observation methods.
- Public web crawling within robots, terms, rate and privacy constraints.
- CRM, helpdesk, customer success and ticketing systems.
- Email, SMS, web, mobile and in-app survey delivery.
- Analytics, data warehouse, reporting and notification systems.

Every connector must declare:
- Authentication method and secret reference (never secret value).
- Data fields, provenance and coverage.
- API and licence restrictions.
- Rate limits, quotas, retention and permitted use.
- Data residency and subprocessors where applicable.
- Health, freshness, error and retry behaviour.
- Cost model and explicit owner approval before any paid activation.

No proprietary data catalogue, provider access, global market coverage or AI-platform integration is assumed until independently contracted, implemented and tested. No paid connector or infrastructure is activated by this architecture document.

## 9. Security, privacy and governance

FORTRESS is the governing security and authorisation boundary.

Mandatory controls:
- Tenant isolation and least-privilege access.
- Role- and attribute-based policy enforcement.
- Encryption in transit and at rest.
- Secret references through approved secret management; no credentials in source, prompts or logs.
- Purpose limitation, consent/notice where required, data minimisation and retention schedules.
- POPIA-aligned design for South African personal information; assess other applicable jurisdictions before offering service there.
- DPIA/privacy review for sensitive or high-risk processing.
- Access, export, correction and deletion workflows as legally applicable.
- Separate handling for employee feedback, anonymous responses and sensitive categories.
- Audit trails for agent decisions, human approvals and external actions.
- Incident response, backup, restore and breach-notification procedures.
- Human review for consequential decisions and disputed interpretations.

Do not claim HIPAA, ISO, SOC 2, GDPR certification or any other certification/compliance status merely because a competitor advertises it. Each applicable control and assurance must be independently implemented, assessed and evidenced.

## 10. Platform and infrastructure alignment

- **NODE01:** logical software/runtime identity only. NODE01 is never a machine, server, VM, host or infrastructure resource.
- **Execution environments:** separately managed, replaceable physical, virtual, containerised or distributed substrates to which software is explicitly bound.
- **FORTRESS:** identity, secrets, permissions, policy, approvals and audit governance.
- **Runtime Fabric:** coordinates authorised software execution and runtime infrastructure.
- **DATABASE:** persists tenant-scoped observations, evidence, workflows and audit records.
- **EDGE / MULTI-EDGE:** provide delivery, routing and protection capabilities where required.
- **IZAKHONO CODE:** builds and maintains the platform through authorised, reviewable workflows.
- **J.A.R.V.I.S. / AI Workforce:** orchestrates agents within declared permissions and execution boundaries.
- **CONNECTA:** may consume approved intelligence and workflow capabilities through governed APIs.

The intelligence platform must not require a particular third-party hosting vendor. Infrastructure adapters remain replaceable. Existing owned-first architecture and investments are preserved.

## 11. Proposed service boundaries

Initial logical modules (not a commitment to separate microservices):
- `signal-ingestion`
- `signal-search-intelligence`
- `signal-ai-visibility`
- `signal-entity-geo`
- `signal-reputation`
- `experience-surveys`
- `experience-feedback`
- `experience-cases`
- `intelligence-evidence`
- `intelligence-agent-orchestration`
- `intelligence-policy-adapter`
- `intelligence-reporting`

Start with modular boundaries and explicit contracts. Split into independently deployed services only when scale, security isolation, operational ownership or release cadence justifies it.

## 12. Delivery phases and acceptance gates

### Phase 0 — Architecture and governance
- Approve product boundaries, canonical schemas and event lifecycle.
- Define tenant isolation, FORTRESS policy model and privacy classifications.
- Define connector contracts, evidence requirements and audit events.
- Confirm ownership of each module and migration path.
- **Gate:** architecture review and security/privacy review completed.

### Phase 1 — First-party EXPERIENCE foundation
- Build tenant-scoped survey builder and response capture.
- Implement versioned NPS, CSAT and CES instruments.
- Add role-based dashboards and feedback classification.
- Implement case routing, assignment, resolution and follow-up.
- **Gate:** deterministic metric tests, access-control tests, tenant-isolation tests, audit tests and end-to-end closed-loop tests pass.

### Phase 2 — SIGNAL foundation
- Implement source registry and provider-neutral ingestion contract.
- Add manually configured query/prompt monitoring and evidence capture.
- Add trend baselines, provenance and source-health reporting.
- **Gate:** source rights documented, repeatable collection verified, provenance complete and confidence limitations visible.

### Phase 3 — GEO and AI visibility
- Implement public-site technical audit, entity records and structured-data validation.
- Implement repeatable AI-answer test suites with recorded conditions.
- Add citation/source analysis and competitor comparisons.
- **Gate:** reproducible test runs, traceable citations, no guaranteed-ranking claims and verified factual correction workflow.

### Phase 4 — Agentic intelligence
- Introduce bounded agents for detection, cross-checking, recommendations and workflow support.
- Add approval policies, idempotency, replay protection and action audit.
- **Gate:** adversarial tests, permission tests, low-confidence fail-safe tests and human-approval tests pass.

### Phase 5 — Commercial readiness
- Add customer onboarding, tenant administration, plan limits, billing integration and support operations.
- Complete privacy/security assessment, backup/restore drills, incident response and operational runbooks.
- **Gate:** independent security review, legal/privacy sign-off, production acceptance and explicit owner release approval.

## 13. Non-goals and prohibited shortcuts

- No claim that IZAKHONO currently has Trajaan-scale data, connectors, query volumes, markets or model coverage.
- No guarantee of AI citations, recommendations, SEO rankings or commercial outcomes.
- No scraping or reuse that violates provider terms, licences, privacy or access controls.
- No fake reviews, undisclosed paid citations or fabricated community seeding.
- No automatic customer contact, public publishing, spend or consequential decisions without authority.
- No cross-tenant data leakage or training on customer data without explicit lawful basis and contractual permission.
- No production migration, deployment, DNS change, infrastructure purchase or paid subscription as a consequence of this specification.
- No conflation of NODE01 software identity with an execution environment.

## 14. Definition of done

The architecture is ready to move from specification to implementation only when:
1. Product and data boundaries are approved.
2. Canonical schemas and versioning are reviewed.
3. FORTRESS policies and tenant isolation are testable.
4. Privacy classifications, retention and lawful source-use rules are documented.
5. Connector economics and provider rights are known before activation.
6. Every insight is traceable to evidence and method/version.
7. Every consequential action has an accountable authorisation record.
8. Outcomes can be measured without overstating causality.
9. CI and security tests pass for the implementation.
10. Production activation receives separate explicit approval and verified operational evidence.

---

**Architectural principle:** Understand demand. Verify evidence. Understand experience. Recommend responsibly. Act only with authority. Measure outcomes. Improve continuously.
