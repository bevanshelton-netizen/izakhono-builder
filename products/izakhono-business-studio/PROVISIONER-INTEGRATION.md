# Business Studio → Provisioner

The Business Studio produces a versioned business blueprint. The Provisioner consumes that blueprint through the adapter contract in `provisioner-adapter.json`.

## Contract

`blueprint.schema.json` is the source contract for Business Studio output. The adapter translates each workflow capability into an implementation job without coupling Business Studio to a specific infrastructure provider.

## Flow

```text
Business Studio
      ↓
Blueprint JSON
      ↓
Provisioner Adapter
      ↓
Provisioning Jobs
      ↓
IZAKHONO owned runtime
      ↓
Domain / DNS / TLS / Mail / Commerce / CRM / Growth
      ↓
Acceptance evidence
      ↓
LIVE_VERIFIED
```

## Provider rule

IZAKHONO owns the control-plane state, workflow and business logic. External providers are replaceable adapters. Provider credentials remain server-side. A successful CI run or generated blueprint does not itself establish public-live status.

## Next implementation boundary

The runtime Provisioner should accept the blueprint, validate it against `blueprint.schema.json`, create an auditable provisioning job, execute only the requested capabilities, and transition status only after each required acceptance check succeeds.
