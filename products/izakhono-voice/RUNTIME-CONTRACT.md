# IZAKHONO VOICE™ Runtime Contract

## Purpose

This layer makes the call-centre core executable against interchangeable providers without changing the orchestration logic.

## Provider boundaries

- `TelephonyAdapter`: answer, dial, transfer, SMS and hang up.
- `VoiceAdapter`: speech-to-text and text-to-speech.
- `KnowledgeAdapter`: tenant-scoped knowledge/RAG retrieval.
- `ModelAdapter`: response generation.
- `CaseStore`: customer lookup and call-case persistence.

## Local verification

`runIzakhonoVoiceContractCheck()` uses deterministic loopback adapters to verify:

1. Caller identity is captured at call start.
2. The call case is persisted.
3. Conversation messages reach the model boundary.
4. Knowledge context reaches the model boundary.
5. Human handoff reaches the telephony boundary.
6. The orchestration layer has no direct dependency on a vendor SDK.

These loopback adapters are test infrastructure only. They do not represent a production telephone connection or AI provider.

## Next production adapter

The next adapter should implement a real SIP/telephony gateway and connect it to the same `TelephonyAdapter` contract. Provider credentials must remain runtime secrets and must never be committed to the repository.
