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

These are logical voice keys, not claims that audio samples or provider voices have already been provisioned. Server-side provider mapping and voice audition are required before release.

## Architecture
1. Product profile selects a distinct default logical voice.
2. Authenticated user preference may override voice, language and speech rate.
3. Resolver validates that a selected voice belongs to that product and that the requested locale is supported.
4. A server-side TextToSpeechAdapter maps logical voice keys to the selected provider's voice IDs and synthesizes speech.
5. Provider credentials remain server-side. Provider selection is replaceable; no provider-specific voice IDs are exposed to clients.
6. If a requested voice is invalid, resolver falls back to that product's own default. It must never fall back to a shared generic male voice.
7. Respect reduced-motion/accessibility preferences where applicable, provide mute/stop controls, and do not synthesize private conversation content without the user's explicit playback action.

## Initial language direction
South African English (en-ZA) is the default. Zulu (zu-ZA), isiXhosa (xh-ZA), Afrikaans (af-ZA), Sesotho (st-ZA) and Setswana (tn-ZA) are listed as desired locales. A locale is not production-ready until the chosen TTS provider confirms language/voice support and pronunciation quality has been reviewed by fluent speakers. Do not silently claim support where the provider cannot synthesize it.

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
The provider-neutral profile registry, resolver and unit tests are added in this change. Audio synthesis, provider voice mapping, settings UI, persistence and end-to-end playback are not implemented by this module and must not be represented as live. This separation allows the application to integrate a selected TTS provider without coupling product identity to that vendor.
