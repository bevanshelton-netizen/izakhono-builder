# IZAKHONO VOICE — Product and Engineering Specification

Status: architecture specification committed; implementation and deployment not yet verified.
Owner: IZAKHONO AFRICA (PTY) LTD
Product: IZAKHONO AI
Principle: OWNED-FIRST. EXTERNALLY REVERSIBLE. NO HOSTAGE PLATFORM.

## Mission

Provide a voice-first conversational interface to the existing IZAKHONO AI operating system. The owner can speak naturally, hear spoken responses, interrupt, clarify, and issue authorised instructions across the IZAKHONO ecosystem. Voice is an interface to the existing authenticated assistant and action system; it is not a disconnected demo bot.

## Primary interaction

1. Tap the microphone / Start conversation control.
2. Grant microphone permission through the device/browser.
3. Speak naturally; display a live or final transcript when the platform supports it.
4. Allow the user to correct the transcript before submitting when desired.
5. Send the transcript through the same conversation context and policy/action routing used by text chat.
6. Display what was understood, the current action state, and verified results.
7. Speak the assistant response aloud.
8. Permit interruption, stop speaking, replay, mute, and seamless text fallback.

## Required UI states

idle, requesting_permission, listening, transcribing, awaiting_confirmation, thinking, executing, speaking, interrupted, unavailable, and error. Never display executing or completed unless the corresponding operation is actually running or has returned verified success.

## Capability strategy

- Prefer device/browser-native speech recognition and speech synthesis as a zero-additional-vendor-cost first adapter where available.
- Feature-detect each capability independently. Speech recognition and speech synthesis availability are not guaranteed and must not be conflated.
- Provide text input and readable transcript fallback when recognition is unavailable or permission is denied.
- Provide visible playback controls and text fallback when speech synthesis is unavailable.
- Keep adapters replaceable behind provider-neutral interfaces so IZAKHONO can later deploy its own speech recognition, TTS, language identification, translation, and offline language packs.
- Prioritise South African English and all 11 official South African languages. Offer explicit language selection; only advertise auto-detection or a language when the selected engine actually supports it.
- Do not implement a wake word or background/always-on microphone claim until there is an explicit opt-in design, platform permission, privacy assessment, and verified implementation.

## Action safety and trust

- Voice commands use the same authenticated user identity, tenant boundaries, policy checks, audit trail, and authorisation as typed commands.
- Require explicit confirmation before irreversible, financial, externally communicative, destructive, or security-sensitive actions.
- Read back high-impact intent before confirmation, including amount, recipient, target, and consequence where applicable.
- Do not execute solely from an ambiguous or low-confidence transcript.
- Expose an action timeline: understood request, clarification/confirmation, action started, action outcome, and evidence/reference.
- Never fabricate a tool call, action, or successful outcome.

## Privacy and security

- Do not store raw audio by default.
- Request microphone access only after a clear user gesture and explain why it is needed.
- Keep transcript and audio retention separate; provide clear controls if persistence is introduced.
- Do not send audio to an external provider without explicit disclosure, a documented lawful basis, and appropriate consent.
- Protect sessions, transcripts, action logs, and credentials under FORTRESS identity, policy, audit, and tenant controls.
- Apply rate limits, abuse controls, and secure transport to any server-side voice endpoint.

## Architecture boundaries

Voice client -> Voice Adapter Interface -> Conversation Gateway -> IZAKHONO AI Context/Policy -> authorised tools and product services -> verified action results -> response renderer -> speech output adapter.

The voice client must not contain provider secrets. Server-side adapters own credentials. Keep audio transport, speech recognition, language services, conversation orchestration, and TTS independently replaceable.

## Acceptance tests

- Android mobile layout and touch interaction.
- Permission granted, denied, revoked, and unavailable.
- Recognition unsupported while synthesis is supported, and vice versa.
- Empty, noisy, long, ambiguous, and low-confidence speech.
- South African language selection and honest unsupported-language fallback.
- Network loss and recovery.
- Stop, replay, mute, and interruption while speaking.
- Long assistant responses and text-only fallback.
- Authentication expiry and cross-tenant isolation.
- Confirmation required for money movement, deletion, external messages, and security-sensitive actions.
- Action timeline reflects only actual execution events.
- No raw audio persistence by default.
- Accessibility, keyboard operation, reduced motion, and screen-reader labels.

## Delivery phases

### Phase 1 — Browser/device voice interface
Implement microphone control, feature detection, speech-to-text adapter, speech output adapter, transcript correction, interrupt/stop/replay/mute, and text fallback. Connect to the existing IZAKHONO AI conversation endpoint.

### Phase 2 — Secure action orchestration
Connect voice requests to existing authenticated action routing, confirmation gates, FORTRESS audit events, and truthful execution timeline.

### Phase 3 — South African language support
Add tested language inventory, explicit language selection, language identification where supported, and provider-neutral translation interfaces.

### Phase 4 — IZAKHONO-owned speech services
Deploy replaceable speech recognition and TTS services on IZAKHONO-controlled infrastructure, then add offline language packs and low-connectivity operation. External engines remain optional adapters, not architectural dependencies.

## Release gate

This document is a specification, not evidence that voice has been implemented or deployed. Release only after the acceptance tests pass on real Android devices and supported desktop browsers, privacy/security review is complete, and the deployed service is independently verified.
