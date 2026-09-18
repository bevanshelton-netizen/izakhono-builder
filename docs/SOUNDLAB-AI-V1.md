# SOUNDLAB AI v1

SOUNDLAB AI is a standalone music-creation product that can also be embedded into Allegro, KORA and IZAKHONO Studio.

## Product rule

The customer-facing product, project format, metadata, generation receipts and integration contracts belong to SOUNDLAB. Music-generation providers are adapters, never the product itself.

## v1 that ships in this branch

- mobile-first creator landing page
- prompt + genre + mood + length + tempo + energy controls
- browser-native deterministic instrumental generator
- generated master WAV playback/download
- drums, bass, chords and melody stem generation
- live stem mute/unmute remixing
- four stem WAV exports
- generation metadata receipt
- Allegro/KORA handoff JSON package
- integration status for Local Engine, SOUNDRAW adapter, Allegro/KORA and iKhokha
- launch monetisation surfaces

The local engine uses synthesis/noise generation in the browser and does not require an external music API or sampled commercial recordings.

## Architecture

### Product layer
SOUNDLAB owns:

1. project identity
2. prompts and creative controls
3. generated-asset metadata
4. stem/mix controls
5. receipts and audit data
6. customer entitlements
7. checkout/usage ledger
8. platform handoff contracts

### Provider adapter layer
Premium generation can later route through a provider-neutral server API:

`POST /api/music/generate`

Inputs should remain SOUNDLAB-native. A server adapter converts them into the selected upstream provider format. No third-party provider key should ever be exposed in browser code.

Suggested adapter order:

- `local` — current browser-native engine
- `soundraw` — optional licensed API adapter once credentials/commercial terms are approved
- `owned-model` — future self-hosted/proprietary generation service

Never write upstream provider-specific IDs into core customer records without also retaining a SOUNDLAB project ID.

## Allegro / KORA integration

The browser exports `soundlab.media-handoff.v1` JSON containing:

- SOUNDLAB project ID
- title and generation timestamp
- duration/BPM/stem availability
- creative metadata
- requested target platforms
- rights review gate

The next backend step is a signed server-to-server handoff endpoint that accepts the JSON plus the generated audio/stems and records acceptance/rejection.

## Payments

iKhokha is the intended checkout adapter. This branch deliberately leaves checkout buttons disabled until exact payment links or API credentials are configured server-side.

Working launch-price placeholders:

- Pay as you go: R49/track
- Creator: R199/month
- Studio: R699/month
- API/white-label: custom

These are product defaults, not activated billing commitments.

## SOUNDRAW integration boundary

Do not proxy a SOUNDRAW credential through browser JavaScript. Add the adapter only after:

1. API access credentials exist,
2. current API terms permit the intended multi-user/commercial workflow,
3. the specific endpoint/field contract is verified against current SOUNDRAW documentation,
4. generation and licensing metadata are persisted separately from SOUNDLAB's own project identity.

## Readiness boundary

v1 is a real local technical preview: it creates and exports audio in-browser. It is not yet a production music-generation service, a legal licensing system, a royalty accounting system, or a public payment deployment.

Public launch still requires durable user/project storage, abuse controls, server-side paid entitlements, privacy/T&C/refund documents, provider licensing review where external engines are used, and production hosting/domain validation.
