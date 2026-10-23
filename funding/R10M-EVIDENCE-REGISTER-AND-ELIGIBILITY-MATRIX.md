# IZAKHONO R10M — EVIDENCE REGISTER & FUNDING ELIGIBILITY MATRIX

**Status:** Funding-control document v1  
**Purpose:** Convert the R10m strategy into an auditable evidence-led funding programme.

## 1. Funding control principle

Every funding claim must have an evidence owner, evidence location, status and next action. No claim is treated as fundable merely because it appears in a strategy document.

**Status key:**
- GREEN — documentary evidence available and claim can be substantiated.
- AMBER — plausible/partially evidenced; action required before submission.
- RED — unsupported, ineligible, overlapping or prohibited; do not submit as claimed.

## 2. Master evidence register

| ID | Evidence area | Required evidence | Applies to | Status | Action before submission |
|---|---|---|---|---|---|
| E01 | Corporate | CIPC registration/current company documents | All | AMBER | Collect current certified/company documents |
| E02 | Tax | SARS Tax Compliance Status | TIA/SPII | AMBER | Verify current TCS |
| E03 | Supplier | CSD registration/report | TIA | AMBER | Verify current CSD |
| E04 | Governance | Directors/shareholders/governance records | All | AMBER | Assemble governance pack |
| E05 | Ownership | Share register and B-BBEE evidence | SPII/TIA | AMBER | Confirm ownership percentage and applicable proof |
| E06 | IP ownership | IP register, assignments, licences and ownership chain | All | AMBER | Establish defensible IP chain |
| E07 | Source code | Git history, repository evidence, architecture records | A/B/C | GREEN/AMBER | Snapshot relevant commits and technical evidence |
| E08 | Technical baseline | Current architecture, specifications and known limitations | A/B/C | GREEN/AMBER | Freeze baseline per project |
| E09 | Prototype evidence | Executable demos/tests and test reports | A/B/C | GREEN/AMBER | Preserve reproducible test evidence |
| E10 | TRL | Baseline TRL assessment with supporting evidence | TIA | AMBER | Independent/technical review of TRL claims |
| E11 | Security | Threat model, security architecture, test plan | A/B | AMBER | Complete security evidence; do not claim certification |
| E12 | Compliance | Regulatory/legal boundary assessment | B/C | AMBER | Obtain appropriate professional review |
| E13 | Market | Customer discovery, market research, problem evidence | All | AMBER | Build dated evidence file |
| E14 | Pilot | Pilot design, scope, success criteria and instrumentation | B/C | AMBER | Prepare partner-ready pilot pack |
| E15 | Commercial | LOIs/contracts/invoices/revenue evidence | Investor/pilot | RED until evidenced | Obtain documentary evidence before claiming traction |
| E16 | Financial | Historical financial statements and management accounts | All | AMBER | Assemble finance pack |
| E17 | Budget | Detailed project budget and cost assumptions | TIA/SPII | GREEN/AMBER | Reconcile to project scopes |
| E18 | Cost eligibility | Supplier quotes/payroll/cost schedules and qualifying-cost mapping | SPII | AMBER | Map each proposed cost to SPII rules |
| E19 | Non-overlap | Funding-source allocation register | SPII/TIA | AMBER | Freeze cost allocation before submission |
| E20 | Commercialisation | Route-to-market, pricing, licensing and buyer strategy | TIA/investor | GREEN/AMBER | Convert into evidence-backed plan |
| E21 | Jobs/impact | Jobs plan, skills plan and economic impact assumptions | TIA/investor | AMBER | Quantify with defensible assumptions |
| E22 | Independent validation | Third-party technical/security/market validation where required | Investor/production | RED until obtained | Commission selectively; do not overclaim |

## 3. Project A — IZAKHONO INTELLIGENCE + CONTROL PLANE

**Indicative project budget: R3.0m.**

| Work package | Indicative cost | Evidence needed | TIA TDF fit | SPII fit | Status |
|---|---:|---|---|---|---|
| Intelligence engine | R1.20m | architecture, source, prototype tests, TRL evidence | Strong candidate | Potential, subject to defined development project | AMBER |
| Control Plane | R0.60m | executable modules, APIs, test evidence | Strong candidate | Potential | AMBER |
| Resilience/failover | R0.40m | failure tests, recovery tests, reproducible evidence | Strong candidate | Potential | AMBER |
| Security | R0.30m | threat model, controls, test plan | Potential | Potential if qualifying development cost | AMBER |
| Testing/documentation | R0.25m | test plans/results, technical documentation | Strong candidate | Qualifying categories include documentation/testing | AMBER |
| Prototype infrastructure/tools | R0.25m | invoices/quotes and direct project linkage | Potential | Case-by-case; exclude general software/admin | AMBER |

**Primary funding route:** TIA Technology Development Fund. TIA describes this instrument as supporting prototype development and demonstration at TRL 4–7, with possible private co-funding. citeturn0search0

## 4. Project B — IZAKHONO NAV + FORTRESS

**Indicative project budget: R2.7m.**

| Work package | Indicative cost | Evidence needed | TIA fit | SPII fit | Status |
|---|---:|---|---|---|---|
| NAV core/routing | R0.70m | architecture, prototype, simulation/testing | Potential | Potential | AMBER |
| Road/safety intelligence | R0.50m | datasets/methodology, scenarios, tests | Potential | Potential | AMBER |
| Fleet/security workflows | R0.45m | workflow specs, simulations, pilot design | Potential | Potential | AMBER |
| FORTRESS integration | R0.50m | threat model, security controls, test evidence | Potential | Potential | AMBER |
| Pilot instrumentation/testing | R0.35m | pilot plan, test criteria, instruments | Strong where development-linked | Potential | AMBER |
| Docs/IP/validation | R0.20m | documentation, IP records, validation plan | Potential | Documentation/testing can qualify | AMBER |

**Primary route:** TIA development/commercialisation pathway plus private strategic/enterprise pilots. TIA's commercialisation instrument is aimed at market testing/validation at TRL 8–9. citeturn0search0

## 5. Project C — IZAKHONO PAY

**Indicative project budget: R1.95m.**

| Work package | Indicative cost | Evidence needed | TIA fit | SPII fit | Status |
|---|---:|---|---|---|---|
| Orchestration/API | R0.55m | API spec, executable sandbox, tests | Potential | Potential | AMBER |
| Adapter/routing | R0.35m | provider abstraction, routing tests | Potential | Potential | AMBER |
| Ledger/reconciliation | R0.30m | state/ledger tests, reconciliation evidence | Potential | Potential | AMBER |
| Security/risk | R0.30m | threat model, controls, test plan | Potential | Potential | AMBER |
| Sandbox/pilot | R0.25m | scenario suite, partner pathway | Potential | Potential | AMBER |
| SDK/docs/testing | R0.20m | SDK tests, documentation | Potential | Potential | AMBER |

**Regulatory boundary:** technology and merchant experience may be developed by IZAKHONO, but regulated settlement/custody/acquiring functions must remain with appropriately authorised partners unless and until the necessary authorisations are obtained.

## 6. SPII eligibility gate

SPII Matching has a maximum grant of R5m. Current official guidance states that qualifying development must represent a significant technology advance; development and subsequent production must take place in South Africa; IP must reside in a South African registered company; and simultaneous applications from the same company are not allowed. Qualifying costs include personnel, direct materials, capital/tooling, eligible software, documentation, testing/trials, licensing, QA/certification, patent costs and subcontracting/consulting. Production/commercialisation, marketing/administration, single-client development, basic/applied research, prohibited overlaps and costs incurred before a duly completed application are excluded. citeturn0search1turn1search1

**Decision gate:** Do not select a SPII project until the remaining development work, cost schedule, ownership/IP position, South African production pathway, contribution percentage and non-overlap allocation have been documented.

## 7. TIA application readiness

TIA's checklist requires, among other matters, CIPC registration, appropriate governance, CSD registration, tax compliance, contractual capacity and primary technology-development activity in South Africa. citeturn1search0

TIA's current portal guidance requires full applications to include a due-diligence checklist, financial projections and project execution plan. citeturn1search26

For applications above R1m and below R15m, TIA publishes a desired investment-decision turnaround of 15 weeks from receipt of a full application. citeturn1search6

## 8. R10m capital reconciliation

| Channel | Target |
|---|---:|
| Project A — Intelligence + Control Plane | R3.00m |
| Project B — NAV + FORTRESS | R2.70m |
| Project C — PAY | R1.95m |
| Cross-portfolio validation/commercial/IP/contingency | R2.35m |
| **Total programme** | **R10.00m** |

The R2.35m cross-portfolio allocation must not be assumed eligible for a particular government grant. It is retained in the master capital plan for private capital, commercialisation, validation, IP/legal/governance and contingency, subject to each funder's rules.

## 9. Submission gates

### GREEN — ready to submit
- Corporate documents verified.
- TCS/CSD/current compliance evidence verified where required.
- IP ownership chain documented.
- Project scope frozen.
- Budget reconciled.
- Qualifying/nonqualifying costs separated.
- TRL baseline supported.
- Evidence index complete.
- Funding overlap register approved.

### AMBER — hold
- Missing documents or technical evidence.
- TRL not independently supported.
- Budget assumptions lack quotes/cost basis.
- Pilot/customer claims are exploratory only.
- Regulatory/security review incomplete.

### RED — do not submit as stated
- Claimed customer without evidence.
- Claimed revenue without records.
- Claimed patent/certification/approval without documentary proof.
- Same development cost allocated to overlapping government programmes.
- General administration/marketing presented as qualifying development cost.
- Production/commercialisation work presented as SPII development.

## 10. Next actions

1. Freeze the R10m master budget against these three project scopes.
2. Assemble E01–E22 evidence files.
3. Establish the actual TRL baseline for Projects A/B/C.
4. Obtain cost evidence/quotes for proposed qualifying expenditure.
5. Build the SPII project-selection decision paper.
6. Prepare TIA Statement of Interest inputs and full-application evidence pack.
7. Prepare strategic-investor data room and target-specific versions.
8. Begin documented customer/pilot outreach for NAV/FORTRESS/PAY.
9. Maintain a funding-source allocation ledger to prevent overlap.
10. Conduct final legal, regulatory, financial and technical QC before submission.

**Control statement:** This document is a funding-readiness framework, not evidence that any grant, investment, approval, customer contract or regulatory authorisation has been obtained.