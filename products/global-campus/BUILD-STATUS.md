# Global Campus Build Status — 26 November 2026

## Implemented in the current branch

- Programme architecture and execution plan.
- South African public university and TVET institution seed register (76 records), all explicitly marked for record-level verification.
- Data-source notes covering the DHET private higher-education and private-college registers, the current DHET university directory, and official sector statistics.
- Corrected 2024 DHET private higher-education institution baseline: 138 (not 137).
- Global academic subject taxonomy starter set.
- Node.js catalogue engine for multilingual text normalization, institution/module validation, verified-only student search, relevance ranking, curriculum alignment validation and publication release gates.
- Automated tests for catalogue validation, verified-only discovery, endorsement evidence and rights/editorial gates.
- PostgreSQL schema baseline for institutions, campuses, faculties, departments, qualifications, modules, learning outcomes, subject taxonomy, source provenance, publications, translations, alignments, reviews and change history.
- Student discovery front-end prototype with a clearly labelled fictional demo dataset.
- GitHub Actions test workflow for the catalogue engine.
- IZAKHONO Builder root README updated to include Global Campus.

## Verification state

The code and tests are committed to the feature branch. GitHub Actions run 7 (Global Campus CI) completed successfully on 26 November 2026; the test job and its “Run Global Campus tests” step both reported success. Broader repository workflows were still running at the time of this status update.

The front-end is a local static prototype, not a deployed production website. The PostgreSQL schema is a migration file only; it has not been applied to any database. No production endpoint, payment integration, institution partnership or live curriculum catalogue has been activated.

## Data integrity state

The 76 public institution rows are seed records. They are not individually verified. The DHET 2024 PSET statistical report records 26 public HEIs, 138 private HEIs, 50 public TVET colleges, 146 private colleges and 9 CET colleges. The 2024 report is a dated sector baseline, not a current registration register.

DHET's private higher-education register is updated 28 February 2026. The private-college register is updated 19 May 2026. These should be ingested with each institution's registration status, delivery sites and registered qualifications preserved. Cancelled registrations must not be surfaced as currently approved providers.

The DHET university directory is an official starting point but contains legacy names and stale entries. Use the latest statutory registers and direct institution confirmation to reconcile names and status.

## Remaining work before controlled pilot

1. Import the full current private higher-education and private-college registers with registration statuses and qualification scope.
2. Obtain and verify the current CET institution directory and applicable occupational provider/accreditation lists.
3. Verify all public university and TVET seed rows against current authoritative records.
4. Capture official programme, prospectus, module handbook and module learning-outcome sources institution by institution.
5. Populate the catalogue with verified curriculum records and review dates.
6. Connect the catalogue engine to the approved IZAKHONO data service and identity/authorization layer.
7. Implement the public API, administrative verification console, and production student discovery interface.
8. Complete accessibility, security, privacy, load, backup/restore and end-to-end acceptance testing.
9. Complete rights clearance, academic editing, qualified specialist review and language review for each publication edition.
10. Confirm payment, refund, tax and consumer-law readiness before accepting purchases.
11. Obtain written agreements before claiming institutional endorsement or integrating with any institution's LMS.
12. Complete public HTTPS, DNS, TLS and production monitoring verification before announcing a live service.

## Non-negotiable release rule

No unverified curriculum or institution record appears as an authoritative student result. No publication is released as module-aligned until its source evidence, rights, editorial review and required specialist review have passed. No institution is described as a partner or endorser without written evidence.
