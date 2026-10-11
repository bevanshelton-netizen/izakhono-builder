# IZAKHONO SPORTS API CONTRACT v1

The first API surface is deliberately sport-agnostic.

## Identity

- `POST /v1/auth/register`
- `GET /v1/me`
- `POST /v1/sports-ids`
- `GET /v1/sports-ids/:sportsUid`

## Organisations

- `POST /v1/organisations`
- `GET /v1/organisations/:id`
- `POST /v1/organisations/:id/members`
- `GET /v1/organisations/:id/dashboard`

## Athletes and teams

- `POST /v1/athletes`
- `GET /v1/athletes/:id/passport`
- `POST /v1/teams`
- `POST /v1/teams/:id/members`

## Competitions

- `POST /v1/competitions`
- `POST /v1/competitions/:id/participants`
- `POST /v1/events`
- `POST /v1/events/:id/results`
- `GET /v1/competitions/:id/standings`

## Sponsorship

- `POST /v1/sponsor-profiles`
- `GET /v1/sponsorship/inventory`
- `POST /v1/sponsor-campaigns`
- `POST /v1/campaigns/:id/activations`
- `POST /v1/activations/:id/evidence`
- `GET /v1/campaigns/:id/roi`
- `GET /v1/sponsors/:id/recommendations`

## Commerce

- `POST /v1/subscriptions`
- `POST /v1/payment-intents`
- `POST /v1/payments/webhook`
- `GET /v1/ledger`

## Event model

All significant actions should emit domain events such as:

- `athlete.created`
- `athlete.achievement_recorded`
- `competition.created`
- `event.completed`
- `result.recorded`
- `sponsor.campaign_created`
- `activation.completed`
- `activation.evidence_verified`
- `payment.succeeded`

This lets analytics, notifications, sponsor reporting and future AI features consume the same event stream without coupling them to the core transaction path.
