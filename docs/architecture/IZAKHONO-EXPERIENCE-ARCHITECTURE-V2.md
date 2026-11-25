# IZAKHONO EXPERIENCE — Architecture Specification V2

**Status:** Proposed architecture / review baseline  
**Date:** 2026-11-25  
**Scope:** Documentation-only architecture specification  
**Implementation status:** This document does not assert that EXPERIENCE services, integrations, predictive models, surveys, workflows or production controls have been implemented, deployed, registered or validated.

## 1. Executive decision

IZAKHONO EXPERIENCE is the platform capability for measuring, understanding and improving customer, employee, partner, member, beneficiary and service experiences.

V2 incorporates the useful capabilities demonstrated by Sogolytics—NPS, CSAT and CES measurement; automated survey distribution; real-time dashboards; open-text analysis; alerts; detractor follow-up; closed-loop case workflows; and enterprise research—while extending the concept into a governed Experience Intelligence and Improvement Engine.

The product must do more than collect survey responses or display sentiment. It connects:
1. what people expect;
2. what they actually experience;
3. what evidence indicates is going wrong;
4. who is accountable for responding;
5. what intervention is authorised;
6. whether the intervention improved the outcome.

**Core principle:** EXPERIENCE measures whether an organisation is delivering on its promises, then helps it improve through accountable, evidence-backed action.

This is an additive capability within the existing IZAKHONO ecosystem. It must not create a competing identity, agent scheduler, authorization authority, event ledger, database authority or notification platform.

## 2. Product boundaries and shared ownership

| Capability | Canonical responsibility | EXPERIENCE relationship |
|---|---|---|
| IZAKHONO EXPERIENCE | Survey, feedback, journey, experience analytics, case coordination and improvement domain | Owns experience-domain rules and records |
| FORTRESS | Identity, policy decisions, scoped authorization, approvals, credential protection and audit controls | Authorizes access and consequential actions; EXPERIENCE cannot grant itself authority |
| NODE01 Agent Fabric | Specialist-agent catalogue, task planning/orchestration and bounded tool execution | Hosts or coordinates approved EXPERIENCE agents through existing contracts; no second scheduler |
| Runtime Fabric | Registered workload scheduling, runtime state, health and failover | Provides execution coordination through existing interfaces |
| Authorized HOST execution adapter | Executes permitted work against a separately registered execution environment | Any external side effect requires the actual approved execution path |
| DATABASE / owned persistence architecture | Authoritative persistence and transaction contracts, once confirmed | EXPERIENCE logical records must use the approved persistence owner; this document authorizes no migration |
| CONNECTA | Communication and engagement application capability | Optional channel/application integration through explicit adapters |
| J.A.R.V.I.S. | Management assistance and operational interface | Presents approved insights and workflows; not an independent authorization authority |
| SIGNAL | Search demand, market, competitor, reputation and AI-answer intelligence | Provides market expectations and external context; not a substitute for first-party experience evidence |
| CODE | Software engineering and controlled delivery | May implement approved improvements; cannot self-authorize production changes |
| INFRASTRUCTURE / MULTI-EDGE | Owned execution, hosting, network and delivery foundations | Provides platform runtime and channel delivery where available |

Existing shared contracts are authoritative. Reuse them after interface reconciliation; do not duplicate their state or responsibilities.

## 3. Experience domains

The domain model supports multiple experience programmes without forcing all feedback into a customer-only model.

- **Customer Experience:** acquisition, onboarding, product/service usage, support, renewal, retention and advocacy.
- **Employee Experience:** engagement, workplace experience, internal services and organisational feedback.
- **Partner Experience:** supplier, distributor, contractor and strategic-partner relationships.
- **Member Experience:** membership, participation, communications, benefits and renewals.
- **Beneficiary Experience:** programme access, service quality, outcomes and dignity of service.
- **Service Experience:** support interactions, fulfilment, response, resolution and service reliability.

Each programme defines its audience, purpose, lawful basis, data classification, measurement plan, channels, retention rules, access policy and accountable owner. Sensitive programmes require additional review before collection or analysis.

## 4. Measurement framework

### 4.1 Net Promoter Score (NPS)

The standard recommendation question asks how likely a respondent is to recommend an organisation, product or service on a 0–10 scale.

Standard classifications:
- Detractors: 0–6
- Passives: 7–8
- Promoters: 9–10

Formula:

`NPS = (% Promoters) - (% Detractors)`

The result ranges from -100 to +100. Use the standard boundaries for interoperable NPS reporting. Organisation-specific operational alert thresholds may be configured separately and must not be presented as the standard NPS definition. A score below 6 is not the standard detractor boundary; scores of 0 through 6 are detractors.

### 4.2 Customer Satisfaction Score (CSAT)

CSAT measures satisfaction with a defined interaction, product, service or milestone. Each programme must declare the question, scale, positive-response threshold, denominator, exclusions and reporting window. The platform must not compare percentages across programmes with incompatible scales or definitions without an explicit normalization method.

### 4.3 Customer Effort Score (CES)

CES measures the effort required to complete a task or resolve an issue. Programmes must declare whether the scale is agreement-based or effort-based, its direction, range and calculation. Higher scores must never be assumed to mean better outcomes without inspecting the configured scale.

### 4.4 Additional measures

Support first-contact resolution, time to resolution, repeat-contact rate, complaint recurrence, response rate, completion rate, renewal/retention outcomes, service-level performance, employee engagement and stakeholder confidence where the programme has a defensible definition.

Every metric definition is versioned and includes owner, question wording, scale, direction, calculation, population, sampling method, exclusions, reporting period and effective dates.

### 4.5 Measurement integrity

- Preserve raw responses separately from calculated aggregates.
- Record survey version and metric-definition version with each response.
- Make denominator, sample size, missingness and response rate visible.
- Distinguish observed responses from estimates, forecasts and model interpretations.
- Do not imply that survey respondents represent the full population without sampling evidence.
- Provide segment sizes and suppress or aggregate small groups where re-identification risk exists.
- Maintain historical comparability only where question, scale, population and method are sufficiently consistent.

## 5. Survey Studio and distribution

### 5.1 Survey Studio

Provide a configurable survey builder with:
- reusable question and survey templates;
- NPS, CSAT, CES and custom question types;
- conditional branching and skip logic;
- validation, required/optional fields and accessible controls;
- multilingual question variants linked to a canonical source version;
- preview, versioning, approval and publication states;
- explicit purpose, consent/privacy notice and retention metadata;
- controlled anonymous, pseudonymous and identifiable response modes.

Survey authors must be able to test logic and accessibility before publication. Changes to a published survey create a new version; they must not silently rewrite historical questions or responses.

### 5.2 Distribution Engine

Support channel adapters for email, SMS, web embed, in-app, mobile and approved messaging integrations. A channel is available only when its adapter is configured, authorized and tested. No channel provider or paid messaging service is assumed by this architecture.

Distribution triggers may include:
- post-purchase or delivery;
- onboarding milestones;
- post-support interaction;
- service completion;
- periodic relationship check-ins;
- renewal or programme milestones;
- employee lifecycle events where lawful and appropriate.

Apply frequency caps, suppression lists, quiet hours, delivery retries, unsubscribe/opt-out handling, consent/purpose checks and tenant-level limits. Do not expose respondent identity in URLs or tracking parameters. Do not send surveys to a person merely because an event exists; the programme's eligibility and contact policy must permit it.

### 5.3 Delivery evidence

Record intended audience/eligibility, channel adapter and version, dispatch event, delivery result where available, retry state, opt-out/suppression result and correlation ID. A dispatch attempt is not proof of delivery, opening or response.

## 6. Feedback Intelligence

### 6.1 Structured and unstructured feedback

Analyse rating responses, free text, complaints, suggestions, support feedback and other explicitly authorized feedback sources. Every ingestion adapter records source, collection purpose, timestamp, tenant, programme, subject/reference where permitted, classification, consent/lawful-basis metadata and provenance.

### 6.2 AI-assisted analysis

Permitted analytical outputs include:
- topic and issue categorization;
- sentiment and emotion indicators;
- recurring themes and emerging issues;
- possible root-cause hypotheses;
- urgency and escalation suggestions;
- summaries linked to source evidence;
- suggested response drafts and improvement opportunities.

Model outputs are interpretations, not facts. Retain source-response references, model/provider and version metadata, prompt or analysis-template version, timestamp, confidence/uncertainty, language and human correction history. Redact or minimize personal information before sending content to an external model. External inference is optional and subject to FORTRESS policy and tenant data restrictions.

Sentiment is a signal, not proof of customer intent, employee misconduct, discrimination, negligence or service failure. High-impact decisions require human investigation and corroborating evidence.

### 6.3 Language support

Support multilingual survey content and feedback analysis through versioned language assets. Translation must preserve meaning, response scale and cultural context. Record source language, detected language and translation provenance. Low-confidence language detection or translation must be visible and routed for review. Prioritize South African languages and broader African language coverage as validated data and professional review become available; never claim language support solely because a general-purpose model can produce text in that language.

## 7. EXPERIENCE PREDICT — customer and relationship health

EXPERIENCE PREDICT identifies patterns that may indicate deteriorating experience or elevated retention risk. It is an evidence-backed risk-assessment capability, not a promise of accurate churn prediction.

Potential signals, only when authorized and relevant:
- repeated or unresolved complaints;
- declining satisfaction across comparable surveys;
- increasing support volume or repeat contacts;
- long or worsening resolution times;
- missed service commitments;
- increasing customer effort;
- reduced engagement or usage where permitted;
- upcoming renewal combined with verified service issues;
- recurring negative feedback on a specific journey stage.

Every risk output must include:
- subject and tenant scope;
- risk category and time horizon;
- contributing signals and their source references;
- model/rule version and assessment timestamp;
- confidence, data coverage and known limitations;
- explanation of missing or stale inputs;
- recommended next investigation or intervention;
- review/expiry date and correction/appeal path where appropriate.

Do not infer protected or sensitive attributes, use sentiment as a proxy for them, or make consequential eligibility, employment, credit, healthcare or access decisions solely from a risk score. Risk thresholds require validation against representative data, calibration, drift monitoring and human oversight. When evidence is insufficient, return UNKNOWN rather than a fabricated score.

## 8. EXPERIENCE RESCUE — closed-loop case management

A negative response or risk signal may initiate a case workflow when programme policy allows.

Canonical workflow:

1. **Detect:** a qualifying response, service event or validated risk signal is received.
2. **Triage:** classify issue, urgency, affected journey and evidence completeness.
3. **Corroborate:** retrieve only authorized related records and incidents.
4. **Create:** open an idempotent case with source references and a clear reason.
5. **Assign:** route to an accountable team or owner using tenant-approved routing rules.
6. **Respond:** draft or send communication according to channel permission and human approval policy.
7. **Resolve:** record actions, ownership, timestamps and resolution evidence.
8. **Verify:** invite follow-up feedback when appropriate and permitted.
9. **Learn:** analyse recurring issues and compare outcomes before/after intervention.

Case states should include NEW, TRIAGED, ASSIGNED, IN_PROGRESS, WAITING, RESOLVED, VERIFIED, CLOSED, REOPENED and CANCELLED. State transitions require an actor, timestamp, reason and evidence reference. Reopening must preserve prior history.

Automation may classify, route, remind and draft. Refunds, compensation, contractual commitments, public statements, employment actions, healthcare decisions, account restrictions and other consequential interventions require explicit role-based authority and any necessary human approval. A notification or ticket creation acknowledgement is not proof that a team acted or that a customer issue was resolved.

## 9. EXPERIENCE JOURNEY

Represent the end-to-end journey as versioned stages and measurable touchpoints. A configurable customer journey may include:
1. discovery and information;
2. enquiry and acquisition;
3. purchase or registration;
4. onboarding and activation;
5. product/service use;
6. support and issue resolution;
7. renewal or continuation;
8. advocacy and referral.

Other domains define their own journey maps. Each touchpoint may specify an event trigger, eligible population, survey, metric, channel, service expectation, owner and follow-up workflow. Journey analytics must distinguish an observed event from an inferred stage. Avoid stitching identities across systems without an approved purpose and lawful basis.

## 10. Experience Analytics and reporting

Provide role-scoped dashboards and reports for:
- NPS distribution and trend;
- CSAT and CES by comparable programme/interaction;
- response and completion rates;
- detractor/passive/promoter breakdowns;
- themes, issue categories and sentiment indicators;
- case volumes, ageing, assignment and resolution;
- first-contact resolution and repeat complaint rate;
- journey-stage friction and drop-off where evidence exists;
- customer/employee/partner segment comparisons;
- risk assessments and intervention outcomes;
- survey delivery, suppression and channel health.

Dashboards must show filters, time windows, sample size, denominator, freshness, source coverage and metric definition. Benchmarking against industry standards is permitted only when the benchmark source, sample, methodology, date and licensing rights are documented. Do not invent industry benchmarks.

Executive reporting should separate:
- **Observation:** recorded responses and operational events;
- **Interpretation:** analytical hypotheses and model outputs;
- **Recommendation:** proposed action;
- **Decision:** authorized human/organizational choice;
- **Outcome:** measured result after action.

## 11. EXPERIENCE RESEARCH

Support advanced research projects, questionnaires, sampling plans, recruitment/eligibility rules, fieldwork tracking, qualitative coding, quantitative analysis, exports and research reports. Research plans must document objectives, population, sampling frame, sample size rationale, collection methods, bias/limitations, consent and retention.

Managed research services, paid panels, external research providers and benchmark datasets are optional commercial integrations. No external panel, data purchase or paid research service is implied or authorized.

## 12. Specialist agent responsibilities

These are domain roles to be implemented through the existing NODE01 Agent Fabric and FORTRESS governance, not a separate agent runtime.

| Agent role | Bounded responsibility |
|---|---|
| Experience Monitor | Detect authorized new feedback and programme events |
| NPS Intelligence | Calculate and explain NPS using versioned standard definitions |
| CSAT Analyst | Analyse satisfaction using configured metric definitions |
| CES Analyst | Identify effort/friction patterns |
| Feedback Analysis | Categorize feedback and extract evidence-linked themes |
| Sentiment Intelligence | Produce qualified sentiment indicators with uncertainty |
| Customer Health | Assemble transparent relationship-health evidence |
| Churn Intelligence | Assess validated churn-risk hypotheses and limitations |
| Experience Rescue | Recommend or coordinate approved case workflows |
| Resolution Monitor | Track case states, ageing and verification evidence |
| Journey Analyst | Identify stage-level friction and experience gaps |
| Improvement Analyst | Identify recurring systemic issues and measurable improvement opportunities |
| Experience Reporting | Produce role-scoped reports with provenance and definitions |

Agents cannot approve their own actions, alter FORTRESS policy, access unapproved tenant data, publish externally, spend funds, issue refunds, change contracts, make employment/healthcare decisions or erase evidence. Consequential actions must use existing authorization and execution contracts.

## 13. Logical data model

This is a logical model only. It is not a database schema, migration, persistence selection or production write authorization.

| Entity | Purpose | Essential controls |
|---|---|---|
| ExperienceProgram | Programme purpose, domain, owner and policy | Tenant scope, version and lifecycle |
| Journey / JourneyStage | Versioned journey and touchpoints | Effective dates and provenance |
| Survey / SurveyVersion | Survey definition and immutable published versions | Owner, purpose, question version and approval |
| MetricDefinition | NPS, CSAT, CES and custom calculations | Versioned scale, formula and denominator |
| SurveyDispatch | Audience eligibility and delivery attempt | Consent, suppression, channel evidence and idempotency |
| Response | Submitted answer set | Tenant/programme scope, classification and retention |
| ResponseAnswer | Individual answer and question reference | Survey-version binding and redaction |
| FeedbackSource | Authorized external/internal source reference | Provenance, purpose and source terms |
| AnalysisResult | Model/rule interpretation | Model/version, confidence, source links and review state |
| ExperienceSignal | Observable risk or issue indicator | Source, freshness, classification and validity |
| HealthAssessment | Explainable relationship risk assessment | Model/rule version, time horizon and contributing evidence |
| ExperienceCase | Closed-loop issue and intervention record | Owner, state, idempotency and audit |
| CaseAction | Work performed or proposed | Actor, approval, result and evidence |
| FollowUp | Follow-up request and result | Purpose, channel and delivery evidence |
| ConsentPreference | Contact/processing preference | Scope, purpose, source, timestamp and revocation |
| ResearchProject | Research plan and fieldwork | Sampling, methodology, consent and retention |
| AuditEvent | Accountability event | Correlation, append-only semantics and tenant scope |

Database owner, authoritative persistence, migration owner, transaction boundaries, row-level controls and retention implementation must be reconciled with the existing owned-runtime architecture before code or schema work.

## 14. Event and integration contracts

Use versioned, provider-neutral contracts. Candidate domain events include:
- experience.program.created / updated / archived;
- survey.version.published;
- survey.dispatch.requested / attempted / delivered / failed / suppressed;
- feedback.response.received;
- feedback.analysis.completed / review_required;
- experience.signal.detected / expired;
- experience.health.assessed;
- experience.case.created / assigned / updated / resolved / reopened;
- experience.followup.requested / completed;
- experience.outcome.measured.

Every event carries event_id, schema_version, tenant_id, programme_id, occurred_at, recorded_at, actor/source, correlation_id, causation_id, idempotency_key, payload classification, purpose reference and evidence/provenance references. Corrections are compensating events; do not silently rewrite history.

Integration rules:
- SIGNAL may contribute authorized market expectations and public-source context; it must not be mixed with respondent evidence without source labels.
- CONNECTA or another channel application may deliver approved communications through explicit channel adapters.
- J.A.R.V.I.S. may surface insights and initiate approved workflows but cannot bypass FORTRESS.
- NODE01 Agent Fabric coordinates bounded agent tasks; it remains the single orchestration layer.
- FORTRESS evaluates authorization at the enforcement point.
- Runtime Fabric and the authorized HOST execution adapter provide execution only where registered and verified.
- External AI, messaging, survey, analytics and research providers are optional adapters, not systems of record or mandatory dependencies.

## 15. Security, privacy and compliance

Design for POPIA-aligned processing and applicable jurisdictional requirements. Requirements include:
- documented purpose and lawful basis for each collection and processing activity;
- data minimisation and privacy-by-design;
- clear notices and consent where required;
- respondent access, correction, objection and deletion handling where applicable;
- configurable retention and defensible deletion;
- encryption in transit and at rest;
- tenant isolation at API, database, queue, cache, analytics, export and backup layers;
- least-privilege role and attribute-based access;
- sensitive-text redaction before external processing;
- data residency and cross-border transfer review;
- auditable administrative access and exports;
- breach and incident response integration;
- suppression and opt-out enforcement across all distribution channels.

Anonymous survey mode must be technically designed so that identity is not inadvertently recoverable from logs, tokens, metadata or small-group reporting. Confidential is not the same as anonymous. Employee feedback requires particular care to prevent retaliation and re-identification.

Healthcare, financial, employment and other regulated deployments require separate legal, security and operational assessment. Do not claim HIPAA, ISO, SOC, GDPR or any other certification/compliance status for IZAKHONO based on another vendor's claims or this architecture document.

## 16. Reliability, fairness and analytical assurance

- Use idempotency for event ingestion, dispatch, case creation and workflow retries.
- Bound retries and use dead-letter/reconciliation procedures.
- Show delayed, missing and stale data explicitly.
- Preserve raw evidence and versioned calculations.
- Monitor response bias, non-response, sampling coverage and segment imbalance.
- Test sentiment and classification quality across supported languages and relevant groups.
- Calibrate predictive models against representative, time-separated validation data.
- Monitor false positives, false negatives, drift and subgroup performance where lawful and statistically defensible.
- Provide human review, correction and override with reasons.
- Never turn low-confidence or missing data into a definitive risk label.
- Do not optimize solely for NPS or survey scores at the expense of actual service outcomes.

## 17. Non-functional requirements

- **Tenant isolation:** no cross-tenant response, case, report, model context, export or backup access.
- **Authorization:** enforce FORTRESS decisions at every consequential operation.
- **Auditability:** correlate survey dispatch, response, analysis, case, approval, action and outcome.
- **Availability:** channel outages must not corrupt responses or silently lose cases.
- **Portability:** export documented data formats and definitions without provider lock-in.
- **Accessibility:** survey builder and respondent flows support accessible interaction and assistive technologies.
- **Localization:** versioned locale content, timezone correctness and language provenance.
- **Performance:** dashboard freshness and analytical latency are measured and displayed.
- **Cost transparency:** optional providers and paid channels have explicit usage/cost visibility and approval gates.
- **Explainability:** scores and recommendations link to definitions, data coverage and evidence.

## 18. Phased implementation and acceptance gates

### Phase 0 — Architecture reconciliation
Inspect existing experience-related products, identity, FORTRESS, NODE01 Agent Fabric, Runtime Fabric, event/audit, database and communication contracts. Identify canonical owners and unavailable interfaces.

**Exit:** reviewed component/interface matrix, data classification, threat model, retention principles and explicit gaps.

### Phase 1 — Measurement and survey contracts
Define versioned survey, question, metric, response, dispatch and consent contracts. Implement standard NPS calculations and configurable CSAT/CES definitions only after persistence and authorization owners are confirmed.

**Exit:** deterministic calculation tests, survey-version integrity, metric comparability rules and tenant-isolation tests.

### Phase 2 — Feedback ingestion and analytics
Add authorized channel/source adapters, raw feedback provenance, structured analysis contracts, human review and reporting definitions.

**Exit:** source traceability, redaction tests, language/quality evaluation and explicit unknown/stale states.

### Phase 3 — Closed-loop case workflows
Implement case lifecycle, assignment, escalation, idempotency, notifications and follow-up evidence using approved shared services.

**Exit:** duplicate-event, retry, authorization-denial, delivery-failure, reopen and audit tests pass.

### Phase 4 — Journey and relationship intelligence
Introduce journey mapping, transparent health assessments and validated predictive models only when representative data and governance exist.

**Exit:** model validation, calibration, bias/drift review, explainability and human-oversight gates pass. If evidence is inadequate, keep predictive capability disabled and use descriptive signals only.

### Phase 5 — Enterprise research and integrations
Add advanced research, additional languages, optional providers and benchmark adapters with documented terms, privacy and costs.

**Exit:** each integration has verified capability, data-handling, revocation, failure and cost behavior.

## 19. Mandatory acceptance tests

1. NPS classifies 0–6 as detractors, 7–8 as passives and 9–10 as promoters.
2. NPS formula returns promoter percentage minus detractor percentage and handles empty samples as unavailable, not zero.
3. CSAT/CES calculations use the exact versioned scale, direction, threshold and denominator.
4. Historical responses remain bound to the survey and metric versions active at submission.
5. Published survey edits create a new version and preserve prior definitions.
6. Anonymous mode does not expose respondent identity through API, logs, exports or analytics.
7. Opt-out, suppression, consent and frequency caps are enforced before dispatch.
8. Dispatch attempts, provider acknowledgements and confirmed delivery are represented as distinct states.
9. Duplicate events do not create duplicate responses, cases, messages or actions.
10. A tenant cannot access another tenant's programme, survey, response, case, report or export.
11. Sensitive feedback is redacted/minimized before optional external model processing.
12. Every AI analysis links to source evidence and records model/template/version, language and uncertainty.
13. Sentiment or risk output alone cannot trigger a consequential adverse decision.
14. Unknown, stale or insufficient data is never labelled healthy or low risk.
15. Predictive models require documented validation, calibration, drift and subgroup evaluation before activation.
16. Case transitions record actor, reason, timestamp and evidence.
17. Case resolution is not labelled verified until the required verification evidence exists.
18. Refunds, compensation, contractual changes and external publication require appropriate authorization.
19. Employee survey reporting applies small-group suppression and re-identification controls.
20. Cross-language analytics records source language and translation provenance.
21. Benchmark comparisons identify source, methodology, date and licensing basis.
22. Retention and deletion policies apply consistently to primary data, analytics, exports and backups.
23. External provider failure does not silently discard feedback or falsely mark a case complete.
24. Every consequential action has a correlated FORTRESS decision and durable audit/evidence reference.
25. Architecture validation does not modify production databases, DNS, runtime, credentials, paid services or deployments.

## 20. Explicit non-goals and release truth

This specification does not:
- implement or deploy an EXPERIENCE application or service;
- create or migrate a database;
- assert a confirmed authoritative database or migration owner;
- register a production messaging, survey, AI or analytics provider;
- purchase benchmark data, research panels, SMS, email or other paid services;
- send surveys or contact customers/employees;
- create live cases or execute interventions;
- activate churn prediction or make customer/employee decisions;
- claim HIPAA, SOC, ISO, GDPR or other certification;
- change DNS, runtime registration, credentials, production routing or infrastructure;
- assert that any feature is production-ready.

Use explicit states:
- **PROPOSED:** documented architecture only.
- **IMPLEMENTED:** code exists and its exact scope is identified.
- **VALIDATED:** named tests passed in a named environment.
- **REGISTERED:** actual adapter/provider/runtime registration is confirmed.
- **AUTHORIZED:** a current FORTRESS decision permits the exact action.
- **DEPLOYED:** deployment evidence identifies artifact and target.
- **PRODUCTION VERIFIED:** live acceptance and monitoring evidence demonstrate required behavior.

A state is never inferred from a prior state.

## 21. Immediate next engineering action

Keep this V2 specification isolated for review. Next perform a read-only Phase 0 reconciliation against the current main branch and active shared platform contracts. Identify whether an EXPERIENCE product/domain already exists on another branch, assign canonical ownership for survey/feedback records, consent, case lifecycle, metrics, analytics, audit and channel delivery, and record gaps before implementation.

Do not merge into an active unrelated release branch. Do not create production schemas, migrations, provider accounts, paid services, credentials, surveys, customer communications or runtime changes as part of this architecture work.
