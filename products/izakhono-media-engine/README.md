# IZAKHONO MEDIA ENGINE v1

Owned-first AI content and revenue automation engine for the IZAKHONO portfolio.

## Purpose

Turn a commercial objective into a measurable campaign pipeline:

`objective → research → strategy → scripts → creative → production → SEO → publish → analytics → optimisation → conversion`

The Media Engine is not a clone of a YouTube automation project. It uses the same multi-agent pattern while extending it from content production into lead generation, landing pages, calls-to-action and revenue measurement.

## Agent team

1. **Campaign Strategist** — converts a business objective into audience, offer, channel and KPI definitions.
2. **Trend & Topic Researcher** — identifies timely topics, search demand, competitor patterns and content gaps.
3. **Content Strategist** — builds the content calendar and content pillars.
4. **Script Writer** — creates hooks, scripts, stories, CTAs and variants.
5. **Creative Director** — produces thumbnail, visual and brand instructions.
6. **SEO Optimizer** — creates titles, descriptions, keywords, tags and structured metadata.
7. **Production Manager** — coordinates TTS, images, video assembly and asset validation.
8. **Publishing Agent** — prepares channel-specific publication packages and schedules.
9. **Analytics Agent** — reads performance and conversion signals.
10. **Optimisation Agent** — promotes winners, retires weak variants and feeds lessons back into strategy.
11. **Revenue Agent** — connects campaigns to landing pages, forms, payment links, CRM events and attribution.

## Portfolio mode

A campaign can target one or more approved IZAKHONO products, including:

- IZAKHONO Africa
- Edu-Build Institute
- FAISReady
- KORA Network
- BEVAN SHELTON
- Allegro Vibez
- Classique Furniture
- IZAKHONO HOST / Website Factory
- future IZAKHONO products

## Owned-first infrastructure

The engine stores campaign state, generated briefs, content manifests, analytics events and attribution data under IZAKHONO control. External AI, media, social and publishing providers are adapters, not the system of record.

No provider is allowed to silently become a source of truth. Provider failures must leave the campaign recoverable and exportable.

## Safety and control gates

- no automatic public publishing without an enabled channel and campaign approval policy;
- no invented performance numbers;
- no claim of `live` without evidence;
- credentials remain server-side;
- generated content is traceable to a campaign and revision;
- paid campaigns require an explicit budget and approval gate;
- regulated or high-risk claims require human review;
- failed provider calls are retryable without duplicating a publication.

## v1 acceptance target

A campaign brief should produce a complete, reviewable pack containing:

- campaign strategy;
- 7-day content calendar;
- scripts and variants;
- thumbnail/creative briefs;
- SEO metadata;
- channel publication manifests;
- landing-page/CTA brief;
- measurement plan;
- optimisation rules;
- revenue attribution events.

The first implementation should be deterministic at the orchestration layer and provider-agnostic at the adapter layer.
