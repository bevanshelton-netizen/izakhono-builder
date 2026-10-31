# FORTRESS Pilot Evidence Readiness

## Purpose

This document defines the release gate for converting FORTRESS synthetic evidence into an institutional pilot evidence package.

## Current Evidence Classes

1. **Synthetic engineering evidence** — deterministic scenario replay and safety assertions.
2. **CI execution evidence** — machine-generated workflow run, job and artifact identifiers.
3. **Controlled institutional pilot evidence** — real institution data under approved governance.
4. **Production evidence** — post-approval operational performance.

Only classes 1–2 are currently eligible before an institutional pilot. No synthetic result may be represented as real-world fraud reduction.

## Mandatory CI Evidence

The FORTRESS Pilot Evidence workflow must produce:

- successful workflow run;
- acceptance-suite result;
- pilot-evidence-harness result;
- `sandboxOnly=true`;
- `liveMoneyMovement=false`;
- downloadable evidence artifact;
- run/job/artifact identifiers.

The workflow currently runs on changes under `products/fortress/**` and supports manual dispatch. See `.github/workflows/fortress-pilot-evidence.yml`.

## Institutional Pilot Gate

A real pilot cannot begin until the institution approves:

- data-sharing and privacy terms;
- security architecture and access model;
- integration scope;
- lawful basis and retention requirements;
- human decision and escalation controls;
- measurement baseline;
- rollback/disable procedure;
- incident-response responsibilities.

## Pilot Measurements

The preferred measurement set is:

- detection lift;
- fraud-loss avoidance, where independently measured;
- false-positive rate;
- decision latency;
- analyst handling time;
- cases per 1,000 events;
- network-pattern discovery;
- reason-code coverage;
- audit completeness;
- integration effort;
- availability and resilience.

## Safety Boundary

FORTRESS does not independently custody, transfer, freeze, recover or settle customer funds. Any consequential financial action remains subject to authorised institutional systems, contracts, applicable law and human governance.

Initial pilot operation remains sandbox-first with `liveMoneyMovement=false`.

## Executive Claim Standard

Approved: “FORTRESS is designed to complement institutional controls by turning fragmented risk signals into an explainable decision and intelligence layer.”

Not approved: claims that FORTRESS eliminates fraud, guarantees savings, replaces an institution's fraud stack, or has achieved real-world fraud reduction before such results are measured in an approved pilot.
