# IZAKHONO CREATOR

Conversational creative-production engine for IZAKHONO.

## Purpose

Turn a natural-language creative brief into an executable production plan. The first vertical is music and short-form video, with the architecture designed to expand into film, advertising, education and business media.

## Core principle

**One conversation -> one production plan -> orchestrated skills -> reviewable outputs.**

IZAKHONO CREATOR is not tied to a single AI vendor. Model providers are adapters behind the orchestration layer. A provider may generate text, images, audio or video, but the Creator owns the workflow, project state, skill registry, approvals and output manifest.

## MVP capabilities

- Conversational creative brief intake
- Deterministic project planner fallback (no external AI required)
- Skill registry and skill routing
- Music-video production plan
- Short-form social cut plan
- Character/visual consistency requirements
- African-language localization planning
- Human approval gates before external publishing or paid generation
- Provider-neutral output manifest

## Initial skills

- `director` — converts the brief into scenes, tone, pacing and production constraints
- `music-video` — maps a song into a music-video treatment and shot list
- `social-pack` — creates a short-form derivative plan for TikTok, Reels and Shorts
- `african-localization` — plans language, cultural and market adaptations without stereotyping

## Safety / truthfulness

The prototype never reports that a video has been generated, published or made live unless an adapter returns verifiable evidence. Paid generation, external publishing and irreversible actions remain approval-gated.

## Run

From the repository root:

```bash
npx wrangler dev --config products/izakhono-creator/wrangler.jsonc
```

The prototype can run without an AI provider. Provider adapters can be added later without changing the public project/skill contracts.
