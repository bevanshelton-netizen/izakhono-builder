# Hercules Builder Adapter Contract

Hercules is an optional application-builder execution adapter for IZAKHONO.

## Required capabilities

The adapter must accept an approved objective and return machine-readable events for:

- plan created
- milestone started
- source changed
- build completed
- tests passed/failed
- repair attempted
- deployment requested
- deployment verified
- external gate required
- final handover

## Required safety

The adapter must never report production success without evidence. Credentials remain server-side. Payment, domain ownership, DNS delegation and physical-node activation remain explicit external gates.

## Continuous mode

When a milestone succeeds, the orchestrator immediately requests the next dependency-ready milestone. A user message such as `next` is not required.

## Fallback

If Hercules is unavailable, the orchestrator may route the same job to another approved builder adapter. The IZAKHONO objective and state machine remain provider-neutral.
