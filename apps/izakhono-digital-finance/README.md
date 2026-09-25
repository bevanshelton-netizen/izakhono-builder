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
- learning progress stays in the learner's browser local storage
- CSP and baseline security headers are applied by the owned engine

This is intentionally conservative. Persistent accounts, identity, certificates and enterprise workspaces require a separate protected data/auth layer before they are enabled.

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

The API route is `POST /api/v1/automation/evaluate`.

The current engine accepts **pseudonymous learner references only** and rejects unapproved fields. It does not persist learner records.

The operating target is **90–95% routine administration automation**, not a claim of zero accountable human governance.

Human review remains mandatory for regulatory-content changes, translation releases, identity anomalies, security/fraud incidents, learner appeals, regulated-advice escalations, institution-policy conflicts, and payment disputes/refunds.

### Production adapters still required

The automation core does not make the protected services disappear. End-to-end production automation still requires verified, replaceable adapters for:

- identity/auth;
- institutional rosters and persistent learner records;
- payment entitlement;
- notification/reminder delivery;
- identity-aware certificate issuance; and
- persistent institutional reporting.

The public repository deliberately contains an **assessment blueprint only**, not production answer keys. Production questions and scoring keys belong in a protected assessment service.

## Next protected tranche

- protected IZAKHONO account/auth adapter
- enterprise roster + persistent learner profile store
- protected assessment service and question banks
- identity-aware certificate issuer
- automated notification/reminder adapter
- persistent enterprise reporting/dashboard store
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
