# IZAKHONO Digital Finance Academy

Independent IZAKHONO-owned, multilingual professional learning platform for blockchain, digital finance, fintech, digital assets, payments, cybersecurity, fraud defence and compliance — positioned for global institutional capability building as well as individual learning.

**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Product ID:** `izakhono-digital-finance`  
**Current evidence label:** **BUILT / VERIFIED LOCALLY** after `verify.py` and HTTP smoke tests pass.  
**Relationship to EDU-BUILD:** None. This is a separate IZAKHONO product and must not inherit EDU-BUILD branding, accreditation claims, curriculum claims or student records.

## Product model

The launch architecture has three pathways:

1. **Digital Finance Foundations — Free**
   - digital money and payment systems
   - blockchain fundamentals
   - wallet/custody concepts
   - scam and risk awareness

2. **Blockchain & Digital Finance Professional Certificate — Paid**
   - blockchain architecture
   - smart contracts and programmable finance
   - digital assets, tokenisation and custody
   - payments, stablecoins and CBDC concepts
   - regulation, compliance and financial crime
   - cybersecurity and fraud
   - fintech and AI
   - capstone product case

3. **Specialist Labs — Paid**
   - tokenisation
   - digital-asset compliance
   - fraud and cyber defence
   - enterprise blockchain evaluation

The word “certificate” describes an IZAKHONO professional completion credential. The platform must not claim that it is a university degree, nationally registered qualification, accredited programme or professional licence unless the relevant approval has actually been obtained and recorded.

## Independent engine

`engine.py` is a zero-dependency Python 3 HTTP engine dedicated to this product. It serves:

- `/` — learning application
- `/healthz` — liveness
- `/api/v1/status` — platform and engine status
- `/api/v1/catalog` — curriculum
- `/api/v1/platform` — deployment/product manifest
- `/api/v1/automation` — workforce automation operating contract
- `POST /api/v1/automation/evaluate` — stateless pseudonymous learner-state decision route
- `/api/v1/assessment-blueprint` — protected assessment-service design contract
- `/api/v1/payment` — explicit payment gate state

It does not depend on another IZAKHONO product engine.

## Privacy-first MVP

- no analytics SDK
- no advertising tracker
- no external font
- no behavioural profiling
- no customer PII collection in the current engine
- individual learning progress stays in the learner's browser local storage
- protected institutional automation can persist **pseudonymous** learner state, events and action outbox records in SQLite
- institutional stateful routes require an admin bearer token
- CSP and baseline security headers are applied by the owned engine

This is intentionally conservative. The product can persist pseudonymous workforce state without storing names, emails, phone numbers or identity numbers. Persistent identity, certificate naming and any other PII remain behind separate protected adapters.

## Payments

iKhokha is the preferred South African commercial route, but **no product-specific checkout is claimed live here yet**.

The payment endpoint deliberately returns `enabled: false` until all of the following are verified:

1. exact IZAKHONO Digital Finance product and price;
2. product-specific iKhokha checkout/link;
3. settlement/reconciliation path;
4. successful payment confirmation;
5. entitlement or enrolment grant;
6. refund/cancellation and customer support wording;
7. end-to-end test.

A browser button must never grant paid access by itself.

## Owned deployment

Primary route:

`NODE01 -> IZAKHONO CODE -> RUNTIME -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

Build and run:

```bash
cd apps/izakhono-digital-finance
python verify.py
docker build -t izakhono-digital-finance .
docker run --rm -p 8080:8080 izakhono-digital-finance

# To enable protected institutional stateful administration:
docker run --rm -p 8080:8080 \
  -e IZAKHONO_DF_ADMIN_TOKEN='set-a-secret-outside-source-control' \
  -e IZAKHONO_DF_LEARNER_SIGNING_KEY='set-a-second-secret' \
  -e IZAKHONO_DF_CREDENTIAL_SIGNING_KEY='set-a-third-secret' \
  -e IZAKHONO_DF_QUESTION_BANK='/run/secrets/question-bank.json' \
  -v izakhono-df-data:/data \
  -v /secure/question-bank.json:/run/secrets/question-bank.json:ro \
  izakhono-digital-finance
```

Smoke checks:

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/api/v1/status
curl -fsS http://127.0.0.1:8080/api/v1/catalog
```

The owned route is not **OWNED LIVE VERIFIED** until the portfolio infrastructure directive's public DNS, TLS, EDGE, backup/restore and rollback gates pass.

## External resilience

`vercel.json` supports a static external resilience route. In static mode the learning UI and curriculum remain available and `app.js` automatically falls back from the engine API to `curriculum.json`.

An external route is not **EXTERNAL LIVE VERIFIED** until a named public URL is checked over HTTPS and the expected IZAKHONO experience is confirmed.

## Workforce autopilot

The routine learner-administration decision layer is now implemented.

`automation_engine.py` is a stateless decision engine that can automate the normal path through:

- onboarding;
- baseline routing;
- role-based pathway assignment;
- progress decisions;
- targeted remediation;
- completion eligibility;
- certificate eligibility decisions; and
- management-reporting events.

The public decision API is `POST /api/v1/automation/evaluate`.

Protected institutional automation APIs are:
- `POST /api/v1/admin/automation/event` — evaluate and persist a pseudonymous learner event;
- `GET /api/v1/admin/automation/report?institution_ref=...` — aggregate institution-level progress/reporting state;
- `GET /api/v1/admin/automation/outbox?institution_ref=...` — pending reminder, governance, certificate and reporting actions for replaceable adapters;
- `POST /api/v1/admin/automation/outbox/ack` — acknowledge a processed outbox action.

These routes require `IZAKHONO_DF_ADMIN_TOKEN`.

The public decision route accepts **pseudonymous learner references only** and rejects unapproved fields. In addition, protected institutional routes can persist pseudonymous learner state, decisions, events and an automation outbox in SQLite without storing customer PII.

The operating target is **90–95% routine administration automation**, not a claim of zero accountable human governance.

Human review remains mandatory for regulatory-content changes, translation releases, identity anomalies, security/fraud incidents, learner appeals, regulated-advice escalations, institution-policy conflicts, and payment disputes/refunds.

### Production adapters still required

The automation core does not make the protected services disappear. End-to-end production automation still requires verified, replaceable adapters for:

- protected identity/auth;
- institutional roster provisioning/import;
- payment entitlement;
- notification/reminder delivery;
- identity-aware certificate issuance; and
- any external dashboard/export destination required by an institution.

The pseudonymous learner/event/outbox store and aggregate reporting API are now built into the independent product engine.

The zero-touch core now also includes:
- protected institutional licence and seat-limit management;
- automatic learner entitlement for active institutional licences;
- pseudonymous roster provisioning;
- signed learner access tokens;
- a runtime-mounted assessment service that never exposes answer keys to the browser;
- automatic scoring into baseline/final automation decisions;
- signed pseudonymous completion records with public cryptographic verification;
- learner action feeds generated from the automation outbox.

The public repository deliberately contains an **assessment blueprint only**, not production answer keys. Production questions and scoring keys are supplied at runtime through `IZAKHONO_DF_QUESTION_BANK`.

## Next protected tranche

- institution-specific SSO/identity mapping where required
- production assessment question-bank content and review workflow
- external email/SMS/push delivery adapter where required
- named identity-aware certificate rendering where required
- external BI/dashboard export where required
- tutor/video layer
- full reviewed multilingual course variants
- verified iKhokha enrolment + entitlement
- downloadable learning records
- accessibility QA
- jurisdiction-specific regulatory content reviewed against current sources


## Global institutional positioning

The institutional market is now a first-class product surface. Target users include banks and payment institutions, regulators and central banks, fintechs, insurers, audit/accounting/legal/advisory firms, universities and training networks, global corporates, industry associations, development-finance institutions, NGOs and multilateral programmes.

Institutional delivery supports executive briefings, workforce academies, specialist labs, public/customer education and private institutional academies. Commercial terms remain quote-based until standard institutional packages are approved.

See `INSTITUTIONAL-GO-TO-MARKET.md`.

## Multilingual architecture

`locales.json` provides the launch institutional interface packs for English, French, Spanish, Portuguese, Arabic, Kiswahili, isiZulu, Chinese, Hindi and German.

This does **not** mean all course content is already fully translated. The product deliberately distinguishes interface localisation from full learning-content localisation. A complete language pack must pass translation QA and subject-matter review before it is marketed as fully available.

The institutional model supports four localisation layers: interface, learning content, jurisdiction overlay and institution-specific terminology/policy overlay.


## Institutional programme builder

The public interface includes a privacy-first institutional programme builder. An institution can select its sector, programme format, language and scale and generate a proposal brief locally in the browser.

The builder:
- does not collect personal data;
- does not create a contract or quote;
- does not grant paid access;
- keeps most institutional pricing quote-based; the FAIS Digital Finance Employee Empowerment Package is fixed at **R1,000 per employee** before separately scoped private-academy setup, bespoke integration or custom localisation;
- can copy or download a proposal brief for procurement/internal discussion.

Programme definitions are sourced from `institutional-offers.json` and are also served from `/api/v1/offers` on the independent engine.


## Zero-touch institutional lifecycle

Once an institution has an approved commercial agreement and an active institutional licence, the product can run the ordinary employee path without IZAKHONO staff manually advancing each learner:

1. an authorised institutional integration provisions pseudonymous employee references and roles;
2. each provisioned employee receives automatic institutional entitlement;
3. a short-lived signed learner access token is issued;
4. the protected assessment service delivers a baseline without exposing answer keys;
5. the automation engine assigns the appropriate learning path;
6. progress/remediation decisions continue automatically;
7. the final assessment feeds the same decision engine;
8. eligible learners can receive a signed IZAKHONO professional completion record;
9. learner actions and institution-level reporting are generated automatically.

This is still **not** a promise of zero accountable human governance. Regulatory changes, identity anomalies, security/fraud incidents, appeals, regulated-advice escalations, policy conflicts and payment disputes remain human-review gates.

For institutions that do not need named certificates or external email/SMS, the pseudonymous access + in-app action-feed model materially reduces the number of external services required.
