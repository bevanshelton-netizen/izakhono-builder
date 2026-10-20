# IZAKHONO EXECUTION OS — EXECUTION CONTRACT

## Purpose
Turn an approved objective into a measurable delivery workflow. The system must distinguish **planned**, **built**, **released**, **marketed**, and **completed**.

## State machine

`INTAKE -> APPROVED -> PLANNING -> BUILDING -> TESTING -> RELEASE_READY -> RELEASED -> MARKETING -> LEAD_CAPTURE -> CONVERSION -> REPORTING -> COMPLETED`

Failure states:

`BLOCKED`, `REJECTED`, `ROLLED_BACK`

A blocked stage must record the blocker and the next recoverable action.

## Completion rule
A project is `COMPLETED` only when:

1. The requested deliverable exists.
2. Automated/manual acceptance checks pass.
3. The release target is reachable or a documented handover artifact exists.
4. Required marketing assets exist when marketing is part of scope.
5. Required links, CTAs, forms, or payment routes have been tested.
6. Evidence is recorded for each required stage.

Generated code alone is never completion evidence.

## Approval gates
Explicit owner approval is required before:

- paid advertising or financial spend
- publishing irreversible public communications when not pre-authorised
- regulated or legal decisions
- destructive data/infrastructure actions
- production changes that could materially affect existing customers

## Default commercial rule
Organic acquisition is the default. No paid advertising is initiated merely because a campaign exists.

## Evidence model
Each stage records:

- status
- started_at
- completed_at
- owner
- evidence URL or artifact reference
- test result
- blocker, if any
- next action

## Marketing acceptance
A marketing package is not complete until it contains, where applicable:

- offer
- target audience
- positioning
- primary CTA
- landing-page copy
- social copy
- short-form video script
- email/WhatsApp follow-up
- distribution checklist
- measurement events

## Sales acceptance
A sales campaign reports confirmed outcomes only. Leads, clicks, views and claims are not counted as purchases. Revenue is reported only from confirmed payment data.
