# IZAKHONO ONE

Umbrella access layer for the IZAKHONO group.

## Business rule

IZAKHONO ONE does **not** legally merge operating entities.

It gives one customer account a single umbrella experience while every underlying entitlement remains explicitly scoped to its own entity.

A group subscription can provision multiple entity/product entitlements in one transaction, but each entitlement is still stored separately as:

- entity_id
- subject
- product_slug
- plan_slug
- status
- expiry

## Subscriber promise

Where the IZAKHONO ONE plan is sold as unlimited, it means:

- no artificial per-message credit meter
- no per-session credit meter
- no hidden "work usage" quota
- active access remains governed by the paid subscription
- fair-use, security, legal restrictions and real compute/storage/network capacity still apply

## Initial umbrella catalogue

- FAISReady
- StudyPal
- Matric Rewrite Academy
- ECD360 / Edu-Build
- KORA
- ALLEGRO-VIBEZ
- DOXA-SURE
- IZAKHONO Intelligence
- future IZAKHONO services

## Architecture

Customer -> IZAKHONO ONE -> IZAKHONO ID -> IZAKHONO ACCESS -> entity-scoped products

The umbrella is the front door. The entities remain separate behind it.
