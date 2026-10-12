# IZAKHONO Idea Foundry

The opportunity-discovery front door for the **IZAKHONO Business Creation Engine / App Factory**.

## What it does

Instead of simply generating random app ideas, it:

1. Captures the target customer and problem zone.
2. Ranks business opportunities using pain, recurring-revenue potential, MVP speed and IZAKHONO fit.
3. Presents a shortlist of opportunities.
4. Generates a build blueprint for the selected opportunity.
5. Hands the blueprint to the next stage: the IZAKHONO App Factory / Builder.

## Product principle

**DON'T JUST GENERATE IDEAS. FIND THE ONE WORTH BUILDING.**

## Current MVP

The current implementation is a zero-dependency browser application in `index.html`. It uses a deterministic opportunity catalogue so it works without an API key. The next production stage can replace the catalogue/ranking layer with the IZAKHONO AI orchestration layer while preserving the same UX and scoring contract.

## Architecture direction

- IZAKHONO-owned infrastructure first.
- Provider-neutral integrations.
- Opportunity discovery → scoring → blueprint → app generation → provisioning → monetisation.
- No production/live claim until deployment and integrations are verified.
