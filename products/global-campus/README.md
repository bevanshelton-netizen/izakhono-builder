# IZAKHONO Global Campus — Catalogue Engine V1

A curriculum-aware discovery and publication-governance engine for the Global Campus Knowledge Network.

## Relationship to ExamReady

Global Campus handles institution/programme/module discovery and supplementary publication alignment. ExamReady remains the separate examination-preparation engine. The two may share subject taxonomies and learning assets, but a tertiary module is not automatically an external qualification or examination pack.

## Implemented in this module

- Unicode-aware normalization for multilingual search.
- Institution and module record validation.
- Official-source and verification-date requirements.
- Student discovery restricted to verified institution and module records.
- Relevance ranking across module codes, titles, qualifications, topics and learning outcomes.
- Publication release gates for rights clearance, editorial approval, specialist review and source references.
- Curriculum alignment validation with evidence and explicit non-endorsement disclosure.
- Tests for the critical trust and discovery rules.


## Initial official curriculum source capture

`data/za-curriculum-source-captures-2026-11.json` stages curriculum records from:
- University of Cape Town, 2026 Commerce Undergraduate Handbook (BCom Financial Accounting: General Accounting, programme code CB001ACC08).
- University of South Africa, official BEd Financial Accounting subject-combination page and FAC1502 module description.

These records remain `needs-review`. They are not returned by verified-only student discovery and are not yet institutional endorsements or product alignments. A dedicated test checks source presence and confirms none are marked verified.

## Run tests

From this directory:

```sh
npm test
```

The test suite uses Node's built-in test runner; no third-party package installation is required.

## Data contract

Institution records must contain:
- `id`, `name`, `country`, `institution_type`
- `source.url`
- `verification.status` and, when verified, `verification.verified_at`

Module records must contain:
- `id`, `institution_id`, `qualification_title`, `title`
- `source.url`, `source.accessed_at`
- `verification_status`, learning outcomes and topics
- `verified_at` when marked verified

An institution/module marked `needs-review`, `discovered` or `superseded` is not returned in public student search. A verified record must always retain its official source and verification date.

## Publication release gate

A publication is discoverable for module-aligned distribution only when:
- rights status is `cleared`;
- editorial status is `approved`;
- required specialist review is approved;
- references are present; and
- at least one reviewed alignment points to a verified module.

## Important boundaries

- The included tests use clearly illustrative fixture records. They are not real institution or curriculum claims.
- Do not add a real module until the current official institution handbook/prospectus/module source has been captured and checked.
- Do not mark institutions or modules verified merely because they appear in a search result.
- Alignment is not institutional endorsement. Endorsement requires documented written evidence.
- This is a reusable catalogue engine, not yet a deployed public marketplace or connected production database.
