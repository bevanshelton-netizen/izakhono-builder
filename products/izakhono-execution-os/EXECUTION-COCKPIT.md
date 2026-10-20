# IZAKHONO EXECUTION COCKPIT

## Purpose
Turn an approved objective into a measurable execution run. The cockpit is the operational surface for moving projects from idea to verified completion and then into organic marketing and sales measurement.

## Core lifecycle
`INTAKE → PLAN → BUILD → TEST → APPROVE → RELEASE → MARKET → MEASURE → COMPLETE`

A run cannot be marked COMPLETE merely because content or code was generated. Each stage requires evidence.

## Cockpit cards

### 1. Objective
- Project name
- Desired outcome
- Owner
- Priority
- Deadline
- Revenue/customer target
- Definition of done

### 2. Execution queue
Each task contains:
- task ID
- description
- dependency
- status: `READY | RUNNING | BLOCKED | REVIEW | DONE`
- evidence
- next action

### 3. Build status
Display:
- files changed
- services affected
- deployment target
- deployment status
- test status
- rollback point

### 4. Marketing status
Display:
- offer
- audience
- landing page
- organic channels
- campaign assets
- scheduled content
- leads
- conversions
- confirmed revenue

Paid advertising remains OFF unless explicitly authorised.

### 5. Completion gate
Required evidence may include:
- URL or deployment evidence
- successful functional test
- customer-facing flow tested
- payment flow tested where applicable
- lead capture verified
- analytics/event verification
- approval recorded

### 6. Blocker handling
Every blocker must produce:
1. blocker description
2. affected stage
3. fallback/recovery path
4. owner
5. next action

External dependencies must be replaceable wherever practical.

## Operating rule
The cockpit must always answer five questions:

1. What are we building?
2. What is happening now?
3. What is blocking completion?
4. What evidence proves the work?
5. What is the next executable action?

## First production workflows

### Digital Product Launch
`OFFER → SALES PAGE → CHECKOUT → DELIVERY → ORGANIC CAMPAIGN → LEADS → CONFIRMED SALES`

### Service Launch
`SERVICE → OFFER → LANDING PAGE → LEAD FORM → FOLLOW-UP → QUOTE → PAYMENT → DELIVERY`

### Website/Product Build
`REQUIREMENTS → IMPLEMENT → TEST → DEPLOY → VERIFY → HANDOVER`

### Lead Generation
`AUDIENCE → OFFER → CONTENT → LANDING PAGE → LEAD → FOLLOW-UP → CONVERSION`

## Revenue integrity
Revenue dashboards must distinguish:
- generated/estimated revenue
- payment attempts
- confirmed purchases
- confirmed settled revenue

Only confirmed purchases count toward sales milestones.

## Security
Secrets never enter task descriptions, source control, logs, campaign copy, or client-visible output. Sensitive actions require explicit authorization where configured by FORTRESS.
