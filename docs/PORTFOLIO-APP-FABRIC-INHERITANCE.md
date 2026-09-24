# IZAKHONO Portfolio App Fabric Inheritance Standard

**Effective:** 24 September 2026  
**Scope:** all existing and future IZAKHONO customer-facing and operator-facing platforms  
**Infrastructure policy:** owned-first, externally reversible

## Decision

Every IZAKHONO platform inherits the **IZAKHONO APP FABRIC** capability contract.

The intent is to give the portfolio the same class of shared platform services visible in modern app-building platforms — backend, payments, email, chat, notifications, files/media, AI speech, transcription, recurring workflows, permissions, integrations and streamlined publishing — without making any external vendor the portfolio's source of truth.

This standard is capability inheritance, not a claim that every capability is already production-enabled in every product.

## Mandatory baseline

Every newly registered Builder project receives these modules automatically:

- Leads & CRM
- Accounts & authentication
- Files & media
- Payments
- Email
- Notifications
- Chat
- AI assistant
- AI speech
- AI transcription
- Recurring events
- Roles & permissions
- API integrations
- Admin dashboard
- First-party analytics
- Publish & release
- CEO growth engine

A platform may hide an unused capability from its user interface, but it must not fork or invent a competing infrastructure implementation without an approved exception.

## Shared implementation map

| Need | IZAKHONO service |
|---|---|
| Backend/data/auth/storage | IZAKHONO Core |
| CRM | IZAKHONO CRM |
| Payments | IZAKHONO PAY and verified direct rails, including approved iKhokha routes |
| Subscription/access | IZAKHONO ACCESS |
| AI | IZAKHONO AI GATEWAY |
| Scheduling/recurrence | IZAKHONO TASKS |
| Condition/API execution | IZAKHONO RUNNER |
| File transfer | IZAKHONO SEND |
| Build and release | IZAKHONO BUILDER / CODE / Runtime |
| Security | FORTRESS / Access / EDGE |
| Commercial workflow | IZAKHONO REVENUE |

## Scale

APP FABRIC is designed so stateless services can scale horizontally and stateful services can be moved to production PostgreSQL, object storage, queues and additional workers/nodes.

Do not use unproven capacity claims such as “supports millions of active users” as a factual production statement until the actual platform has load-test and operating evidence for its workload.

The scale ladder is:

1. local / controlled pilot;
2. single-node production;
3. replicated services and managed failover;
4. horizontal application workers;
5. sharded/replicated state where required;
6. regional edge and multi-node operation.

Promotion is evidence-based, not marketing-based.

## Governance

Every shared service must enforce the relevant combination of:

- legal entity isolation;
- platform isolation;
- tenant/centre/account scope;
- role permissions;
- row grants where required;
- audit events;
- least-privilege credentials;
- secrets outside source control;
- protected-data minimisation;
- product-specific retention rules.

Regulated or high-sensitivity data stays in the source product unless a separate approved data flow exists.

## Communications

Email, push, chat and automated follow-up must be permission-aware.

No bulk outbound communication is enabled merely because APP FABRIC provides a messaging capability. Marketing consent, unsubscribe handling, sender-domain reputation, abuse controls and channel-specific policies still apply.

## AI media

Speech generation and transcription are available as standard capability contracts but remain fail-closed until an owner-controlled model/runtime is selected and tested.

Required tests include:

- latency;
- capacity;
- audio/file security;
- accuracy;
- language coverage;
- abuse/content controls;
- cost/compute sustainability.

## Payments

The payment module is present in every product plan so applications do not build ad-hoc payment code.

Presence does not mean the product charges money.

A product may create a live payment only after its specific merchant route, amount, currency, product description, webhook/reconciliation, legal pages, entitlement/fulfilment and settlement path are verified.

## One-action publishing

The desired operator experience is one publish action, but the system must preserve separate evidence for each channel:

### Web / PWA
The publish action may automate build, deployment, health checks, DNS/TLS verification and rollback preparation.

### Android
The publish action may prepare/sign an Android artifact and submit it when the authorised Play developer account, signing material and store metadata are connected.

### iOS
The publish action may prepare/sign an iOS artifact and submit it when the authorised Apple developer account, certificates/profiles and App Store Connect metadata are connected.

No store release is labelled public merely because a package was built.

## Current platforms covered

This inheritance applies to, at minimum:

KORA; KORA Cinema; KORA Gospel TV; KORA Kids; Allegro-Vibez; Allegro Radio; Edu-Build Institute; ECD360; FAISReady; DOXA-SURE; AUTO AI; Learner Driver SA; WorkNow; Memory Mania; Music School; Recording Studio; CROWNÉ by Netty; Business Websites / Supercool; ZEELY-style platform; The Chancellor; FORTRESS; IZAKHONO Code; IZAKHONO Work; IZAKHONO Cloud; IZAKHONO Send; Izakhono Africa Clothing Manufacturing; and every future Builder-created platform.

## Rollout

### Foundation
- Builder baseline modules
- APP FABRIC registry/resolver
- shared CRM inheritance
- infrastructure and entity-boundary inheritance

### Adapter wave 1
- FAISReady
- Edu-Build
- Izakhono Clothing

### Adapter wave 2
- KORA / Allegro family
- WorkNow
- AUTO AI
- Learner Driver SA
- DOXA-SURE

### Adapter wave 3
- remaining consumer, creator and enterprise platforms

Existing verified public routes remain untouched until each APP FABRIC adapter passes end-to-end acceptance.
