# CONNECTA Giving + Adopt-a-Spot Flow Contract

## Purpose

Define the first functional data-flow contract for CONNECTA Giving and Adopt-a-Spot without creating false claims about beneficiaries, organisations, donations, settlements or impact.

## Shared lifecycle

`DRAFT -> SUBMITTED -> VERIFICATION_PENDING -> VERIFIED -> ACTIVE -> COMPLETED -> EVIDENCE_REVIEW -> CLOSED`

A record may also enter `REJECTED`, `SUSPENDED` or `REVIEW_REQUIRED`.

## CONNECTA Giving

A campaign contains:

- campaign ID
- organiser identity
- beneficiary or organisation identity
- category
- title and description
- target amount
- currency
- campaign dates
- verification state
- payment/settlement state
- contribution ledger
- impact/evidence records
- moderation and audit history

### Rules

1. A submitted campaign is not a verified campaign.
2. A displayed target is not money raised.
3. A contribution intent is not a settled contribution.
4. A payment provider confirmation must be reconciled before a contribution is counted as settled.
5. Impact claims require evidence.
6. Refunds, reversals and chargebacks must be reflected in the ledger.
7. Emergency claims require appropriate verification and escalation.

## Adopt-a-Spot

An organisation/project record contains:

- organisation ID
- legal/trading name where applicable
- location
- cause/category
- public description
- nominated-by identity
- verification state
- adoption commitments
- contribution/in-kind records
- project milestones
- evidence and impact records
- audit history

### Adoption types

- monthly sponsorship
- once-off support
- equipment
- food
- clothing
- technology
- building/renovation
- transport
- professional services
- scholarships
- training/jobs
- volunteer time
- other verified in-kind support

## Trust states shown to users

- **Community Nominated** — submitted, not verified.
- **Pending Verification** — verification in progress.
- **Verified Organisation** — required identity/evidence checks passed.
- **Active Campaign** — verified and currently accepting support.
- **Adopted** — a commitment has been recorded.
- **Impact Evidence Pending** — delivery/outcome evidence is still required.
- **Impact Verified** — evidence review passed.
- **Suspended / Review Required** — activity requires intervention.

## User journey

### Giving

Discover -> review verification -> choose amount/type -> payment intent -> payment confirmation -> settlement reconciliation -> receipt -> campaign ledger -> evidence updates.

### Adopt-a-Spot

Discover -> inspect organisation verification -> choose adoption type -> commitment -> fulfilment/payment -> evidence -> impact update -> renewal or completion.

## Non-negotiable verification rule

**No badge without evidence. No donation claim without settlement. No impact claim without evidence.**

The interface must never imply that CONNECTA, an organiser, an NGO/NPO, a beneficiary, a payment partner or a corporate sponsor has completed an action unless the corresponding evidence exists.

## Faith and mission

CONNECTA Giving may express the mission: **For God's glory. To serve people. To restore dignity. To change lives.**

This mission does not replace verification, financial controls, safeguarding, applicable law or transparent reporting.
