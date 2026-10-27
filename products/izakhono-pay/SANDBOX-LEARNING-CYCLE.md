# IZAKHONO PAY — Sandbox Learning Cycle

## Purpose

The sandbox evidence simulator provides isolated synthetic observations for the optimization and learning loop. Synthetic evidence must never be treated as production payment evidence and must never authorize live money movement.

## Closed loop

1. Generate deterministic synthetic observations.
2. Measure the explicitly synthetic experiment.
3. Write the learning audit record.
4. Queue only qualifying `PROMOTE_TO_REVIEW` outcomes.
5. Require an explicit review decision before sandbox promotion.
6. Preserve rollback plans, guardrails, evidence hashes, and audit history.
7. Keep `live_money_movement=false`, `authorization_mode=sandbox_only`, and `external_gate_required=true` throughout.

## Safety boundary

The simulator must not write to payment transactions, provider events, provider routes, refunds, settlements, reconciliation, or live operational alert tables. Production measurement remains unchanged unless an experiment explicitly declares `measurement_source=synthetic_sandbox`.

## Promotion boundary

Sandbox promotion is not production deployment and is not regulatory approval. Any change capable of affecting live payment routing, custody, settlement, regulated activity, or money movement requires the existing external launch gate and cannot be autonomously released by this loop.

## Verification target

A successful synthetic cycle is one where the system can produce observations, calculate an evidence-backed measurement, create a review item when appropriate, record a review decision, and create a sandbox promotion record without any live-money state becoming true.
