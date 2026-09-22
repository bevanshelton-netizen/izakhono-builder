# IZAKHONO Infrastructure Directive Inheritance

Effective for platforms adopting the current central Builder policy after 22 September 2026.

## Purpose

The portfolio circular in `IZAKHONO-PLATFORM-INFRASTRUCTURE-DIRECTIVE.md` is an operating rule, not a suggestion. The central Alpha contract now carries the rule into platform build records.

## Manifest v3

A platform moving to the current shared policy must use `.izakhono.json` version 3 and declare:

- operator and trading name
- authoritative source
- owned target
- currently verified public route
- external fallback/failback route
- approved evidence-based status label
- data dependencies
- authentication dependencies
- payment dependencies
- backup evidence
- restore evidence
- rollback evidence

The infrastructure policy value is fixed to:

`owned-first-externally-reversible`

## Approved status labels

Only these labels are accepted:

- `BUILT / VERIFIED LOCALLY`
- `EXTERNAL LIVE VERIFIED`
- `OWNED LIVE VERIFIED`
- `NOT YET PUBLIC`

The central workflow does not allow a product to invent softer equivalents such as "basically live", "deployed", "ready live" or "production-ish".

## Owned-live guard

`OWNED LIVE VERIFIED` requires:

1. an HTTPS current public route;
2. a concrete owned target rather than a placeholder;
3. backup evidence;
4. restore evidence;
5. rollback evidence.

The CI contract still cannot prove public DNS/TLS or physical NODE01 state by itself. Those values must come from actual deployment evidence and remain subject to the circular's public cutover gates.

## External-live guard

`EXTERNAL LIVE VERIFIED` requires an HTTPS current public route and an explicit external fallback/failback route. External routes remain permitted and reversible; they are not treated as the authoritative source of truth.

## Immutable migration rule

Existing applications that pin an older central Builder workflow SHA continue using that reviewed policy. They are not silently changed.

To inherit this directive in a platform repository:

1. migrate its manifest to version 3;
2. fill the infrastructure record from verified evidence;
3. update its caller workflow to a reviewed immutable Builder commit containing this policy;
4. run the Alpha gate;
5. only then promote under the new policy.

This keeps policy upgrades explicit and auditable.
