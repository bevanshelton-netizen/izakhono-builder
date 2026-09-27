# IZAKHONO Affiliate Autopilot

The Affiliate Engine is intended to operate without routine owner intervention.

## Scheduling

- Primary scheduler: **IZAKHONO TASKS** on owned infrastructure.
- Default cadence: **08:00 Africa/Johannesburg daily**.
- Resilience scheduler: GitHub Actions at **06:00 UTC daily**, which corresponds to 08:00 SAST.
- The resilience path never becomes the source of truth.

## What runs automatically

The autopilot validates the affiliate contract, checks public network reachability, records a health report, raises or updates a GitHub exception issue when needed, closes that issue on recovery, and provides the integration hooks for authenticated feed/API sync once server-side credentials exist.

The engine may reconcile verified conversion events and route approved records to FORTRESS, SUPER ACCOUNTANT and the portfolio CRM when those interfaces are configured.

## What remains gated

No unattended process may accept third-party legal terms, provide banking/tax identity information, authorise paid media spend, materially change commission economics, or release disputed/exceptional payouts.

## Operational rule

Routine healthy runs are silent. The owner is surfaced only when there is an exception requiring a decision or a completed material milestone.
