# IZAKHONO Builder — Speed & Accuracy Standard

**Status:** Mandatory product requirement  
**Effective:** 27 September 2026

## Objective

IZAKHONO Builder must feel immediate without becoming careless.

For ordinary brochure and corporate websites, the target is a polished first preview in **under 60 seconds** on a warm production path. This is a performance target, not a claim that every current deployment already achieves it.

## Performance targets

- Structured brief extraction: <= 2 seconds
- Reusable foundation render: <= 20 seconds
- First polished preview: <= 60 seconds
- Automated QA pass: <= 15 seconds
- Typical correction loop: <= 30 seconds
- Publish candidate after approval: <= 90 seconds

Complex apps, regulated workflows, commerce, custom integrations and large media jobs may take longer.

## How we get there

Run work in parallel rather than serially:

1. Parse the user's brief into a strict structured schema.
2. Resolve brand manifest, legal identity, offer and CTA.
3. Generate layout, copy framework and asset plan concurrently.
4. Reuse prebuilt responsive components and adapters.
5. Generate only the brand-specific parts.
6. Run content QA, link checks, form checks, metadata checks and visual checks concurrently.
7. Rebuild only changed sections on correction.
8. Publish only after the required gate passes.

## Accuracy rules

Speed never authorises guessing.

The Builder must not invent:
- prices;
- company registration details;
- memberships or certifications;
- customer testimonials;
- contact details;
- product functionality;
- legal or regulatory claims.

Missing critical facts are flagged. Verified facts are inherited from the approved brand manifest.

## Accuracy architecture

- schema-constrained brief extraction;
- exact legal-entity fields;
- deterministic validation for required sections;
- reusable approved content blocks;
- duplicate/contradiction checks;
- product-specific compliance rules;
- visual review before public promotion;
- verified HTTPS and intended-content check after deployment.

## Product principle

**Fast because the system reuses infrastructure — not because it skips thinking.**

The business objective is to make an ordinary professional website feel closer to “describe it, see it, refine it, publish it” than to a traditional multi-day agency workflow.
