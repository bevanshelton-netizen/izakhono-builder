# NODE01 Software — Execution Environment Replacement Record

## Locked decision

**NODE01 IS SOFTWARE. THE MACHINE WAS REPLACED.**

The former machine is not NODE01. The replacement machine is not NODE01. NODE01 is the continuing IZAKHONO software/runtime identity.

## Required state

| Field | Required value |
|---|---|
| Logical software identity | `NODE01` |
| Identity type | `software-runtime` |
| Former execution machine | Retired/replaced; not an active NODE01 identity |
| Current execution environment | Replacement machine; separate infrastructure |
| Runtime binding | Must point to the replacement using its verified locator |
| Identity continuity | Preserve the existing NODE01 software identity |
| Promotion | Blocked until the replacement binding and acceptance evidence are verified |

## Binding requirements

The active runtime-binding record must contain:

```json
{
  "logical_node_id": "NODE01",
  "identity_type": "software-runtime",
  "runtime_host": "VERIFIED_REPLACEMENT_ENVIRONMENT_LOCATOR",
  "runtime_host_is_separate": true
}
```

The locator above is a field illustration, not a real hostname, IP address, provider or active binding. Do not commit the illustrative value as a live locator.

## Replacement acceptance checklist

- [ ] Confirm the former machine is no longer the active execution target.
- [ ] Identify the replacement environment from an authoritative source.
- [ ] Verify the replacement's actual locator and administrative ownership.
- [ ] Update the runtime binding without changing NODE01 software identity.
- [ ] Confirm NODE01 reports `identity_type: software-runtime`.
- [ ] Confirm the runtime host is distinct from NODE01.
- [ ] Verify release/artifact identity and runtime health.
- [ ] Verify required workloads and dependencies.
- [ ] Verify backup integrity and perform a restore rehearsal.
- [ ] Verify rollback and post-rollback health.
- [ ] Verify DNS, TLS and public routes independently where applicable.
- [ ] Record timestamped evidence before marking the binding verified or production live.

## Prohibited

- Generating a new NODE01 identity from the replacement machine's machine-id, hostname, IP, serial number or cloud instance ID.
- Referring to either the old or replacement machine as NODE01.
- Reusing the old machine's locator as the active replacement locator.
- Marking the replacement bound, healthy or live without current evidence.

## Evidence status

The software identity and replacement rule are committed in the architecture. The replacement's actual infrastructure locator and machine-side acceptance evidence have not been established in the repository evidence available for this record. Therefore, the replacement binding must remain unverified until those facts are supplied by the actual runtime or its authoritative management plane.
