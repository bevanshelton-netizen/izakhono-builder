# IZAKHONO SPORTS — Universal Rules Engine v1

## Purpose

IZAKHONO SPORTS must support many sports without hard-coding one sport's scoring model into the platform. The rules engine therefore treats scoring, ranking and statistics as configurable competition profiles.

## Rule profile

A competition can declare a rules profile containing:

- `version` — immutable rules version identifier
- `rankingMetric` — points, score, time, distance, placing or custom
- `placingPoints` — optional placing-to-points map
- `scoreAggregation` — sum, average, max, min or none
- `tieBreakers` — ordered deterministic tie-break rules
- `periods` — match/race/heat/set/round structure
- `resultSchema` — sport-specific result fields stored in `result_payload`

## Design rules

1. Never assume that a football scoring model applies to another sport.
2. Store the rules version with competition configuration so historical results remain reproducible.
3. Keep raw official results immutable; derived standings can be recalculated.
4. Explicit result points override generic fallback points.
5. Rankings must expose the rule version and calculation mode.
6. Sport-specific adapters may validate result payloads but must not change the universal domain model.
7. A federation/league can publish a rules profile; competition instances reference that profile.

## Roadmap

### V1
- Generic placing points
- Explicit points from result payload
- Deterministic ordering
- Generic competition standings

### V2
- Persistent rules profiles
- Sport-specific validation schemas
- Tie-breaker pipeline
- Versioned rules
- Federation-owned profiles

### V3
- Live scoring/event state machine
- Automated standings recalculation
- Ranking feeds
- Official result approval/signing
- Historical rules replay

This keeps POWERING ALL SPORTS genuinely sport-agnostic while allowing deep sport-specific intelligence above the common infrastructure.
