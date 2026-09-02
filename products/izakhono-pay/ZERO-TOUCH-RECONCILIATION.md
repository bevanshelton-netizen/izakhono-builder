# IZAKHONO PAY Zero-Touch Reconciliation

Status: **technical foundation only — live settlement automation remains gated**.

## Purpose

This layer reconciles acquirer/provider settlement records against IZAKHONO PAY payment intents without guessing and without taking custody of funds.

The first intended consumer is FAISReady, followed by other IZAKHONO merchant applications.

## Automatic match rule

A settlement may be marked `matched` automatically only when all of the following are true:

1. the merchant/app scope matches;
2. either the provider reference or IZAKHONO merchant reference uniquely identifies one payment intent;
3. the settlement amount exactly equals the intent amount;
4. the three-letter currency exactly matches.

Anything else is an exception requiring review.

The engine deliberately does **not** perform amount-only matching, fuzzy reference matching, heuristic customer matching or auto-adjustment of discrepancies.

## Idempotency

Each normalized settlement record receives a deterministic SHA-256 fingerprint. Reprocessing the same feed record is treated as a duplicate rather than a second settlement.

Persistent D1 tables in `migrations/0007_reconciliation.sql` record:

- provider settlement records;
- reconciliation runs;
- deterministic matches;
- exceptions that need review.

## Non-custodial boundary

Reconciliation records what an authorised acquirer/provider reports. It does not move money, hold customer funds, change bank settlement instructions or originate refunds.

`autoSettlement=false` and `fundCustody=false` are explicit code-level capabilities and are tested.

## Path to live zero-touch reconciliation

The remaining work before live unattended reconciliation is:

1. approved provider/acquirer settlement-feed adapters;
2. signed and verified provider callbacks or authenticated settlement API pulls;
3. production D1 migration and backup/restore proof;
4. merchant-specific mapping for FAISReady and each later platform;
5. alerting/escalation for every `review` exception;
6. reconciliation replay/idempotency proof against provider sandbox data;
7. formal live merchant/acquirer approval and the applicable IZAKHONO PAY regulatory/compliance gates.

Until those gates pass, the engine can be exercised with synthetic/sandbox settlement records only.
