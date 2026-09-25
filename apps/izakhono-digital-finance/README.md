# IZAKHONO Digital Finance Academy

Independent IZAKHONO-owned professional learning platform for blockchain, digital finance, fintech, digital assets, payments, cybersecurity, fraud defence and compliance.

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

## Next protected tranche

- IZAKHONO account/auth integration
- learner profile and persistent progress
- assessment engine and question banks
- identity-aware certificate issuance
- tutor/video layer
- multilingual course variants
- enterprise cohorts and admin
- verified iKhokha enrolment + entitlement
- downloadable learning records
- accessibility QA
- jurisdiction-specific regulatory content reviewed against current sources
