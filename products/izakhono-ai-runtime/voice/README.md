# IZAKHONO Voice Engine V1

## Purpose
Give every IZAKHONO product a recognisable, distinct spoken identity while allowing each account holder to select a supported voice and language. Voice selection is independent of the language model that generates the answer.

## Product defaults
| Product | Identity | Default profile |
|---|---|---|
| IZAKHONO AI | Warm, authoritative executive | za-executive-warm |
| IZAKHONO NAV | Calm, concise navigation | za-nav-calm |
| KORA Network | Friendly, youthful | za-kora-friendly |
| IZAKHONO Builder | Clear technical guide | za-builder-clear |
| FORTRESS | Composed, reassuring security | za-fortress-composed |
| Business Assistant | Professional executive | za-business-executive |
| Edu-Build AI | Patient educator | za-edu-patient |

These are logical voice keys, not claims that seven unique recorded voices have already been provisioned. The first provider adapter targets Microsoft Azure Speech in South Africa North. Its published South African English neural voice choices include Leah (female) and Luke (male); distinct product character can be tuned with product-specific prosody, but truly unique voiceprints require separately licensed/custom voice assets. Do not describe the seven profiles as seven independently recorded voices.

## Architecture
1. Product profile selects a distinct default logical voice.
2. Authenticated user preference may override voice, language and speech rate.
3. Resolver validates that a selected voice belongs to that product and that the requested locale is supported.
4. A server-side TextToSpeechAdapter maps logical voice keys to the selected provider's voice IDs and synthesizes speech. The Azure adapter is implemented for server-side use; it requires AZURE_SPEECH_KEY and an Azure region (recommended: southafricanorth), with an owner-maintained voice map.
5. Provider credentials remain server-side. Provider selection is replaceable; no provider-specific voice IDs are exposed to clients.
6. If a requested voice is invalid, resolver falls back to that product's own default. It must never fall back to a shared generic male voice.
7. Respect reduced-motion/accessibility preferences where applicable, provide mute/stop controls, and do not synthesize private conversation content without the user's explicit playback action.

## Initial language direction
South African English (en-ZA) is the only enabled locale in this initial Azure adapter profile. Other South African languages remain planned, not enabled, until an actual provider voice is configured and pronunciation quality is reviewed by fluent speakers. The resolver deliberately falls back to en-ZA rather than falsely claiming unverified language support.

## Acceptance gates before production
- Distinct audio samples approved for all seven product identities.
- Male/female/neutral options exposed only where the provider has quality voices for the selected locale.
- Per-user voice and language preference saved to the authenticated profile.
- Per-product defaults and per-user overrides verified end-to-end.
- Streaming playback, stop/replay, interruption and fallback tested on desktop and mobile.
- Pronunciation review for South African names, place names and supported languages.
- Latency, audio caching, cost, privacy retention and provider outage behaviour documented.
- No client-side provider secrets; authenticated rate limits and abuse controls enforced.

## Current implementation status
The provider-neutral profile registry, resolver, Azure Speech adapter and unit tests are added in this change. Provider credentials and the production voice map are still deployment configuration. User settings UI, authenticated preference persistence, audio endpoint wiring and end-to-end playback remain outstanding and must not be represented as live.
