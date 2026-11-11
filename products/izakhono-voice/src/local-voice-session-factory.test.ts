import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LocalVoiceStreamSessionFactory } from "./local-voice-session-factory";

function pcmWav(sampleRate: number, count: number): Uint8Array {
  const out = new Uint8Array(44 + count * 2);
  const view = new DataView(out.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) out[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, 9000, true);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

test("local voice pipeline transcribes, reasons with tenant instructions and returns PCMU audio", async () => {
  const originalFetch = globalThis.fetch;
  const outputFrames: Uint8Array[] = [];
  const errors: unknown[] = [];
  let llmSystemPrompt = "";
  const wav = toBase64(pcmWav(24000, 2400));

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/v1/transcribe")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.schema, "izakhono.speech.transcribe.v1");
      return new Response(JSON.stringify({ ok: true, text: "I need your opening hours." }), { status: 200 });
    }
    if (url.endsWith("/api/chat")) {
      const body = JSON.parse(String(init?.body));
      llmSystemPrompt = body.messages[0].content;
      return new Response(JSON.stringify({ message: { content: "We open at nine in the morning." } }), { status: 200 });
    }
    if (url.endsWith("/api/v1/generate")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.schema, "izakhono.speech.generate.v1");
      return new Response(JSON.stringify({ audio: { data_url: "data:audio/wav;base64," + wav, sample_rate: 24000 } }), { status: 200 });
    }
    throw new Error("Unexpected local service URL: " + url);
  };

  try {
    const factory = new LocalVoiceStreamSessionFactory({
      speechRecognitionUrl: "http://asr.internal/api/v1/transcribe",
      speechRecognitionKey: "test-asr-key",
      languageModelUrl: "http://llm.internal",
      languageModelName: "local-test-model",
      instructionsForCall: async authorization => {
        assert.equal(authorization.tenantId, "tenant-123");
        return "Business hours are 09:00 to 17:00.";
      },
      speechSynthesisUrl: "http://speech.internal/api/v1/generate",
      speechSynthesisKey: "test-speech-key",
      language: "English",
    });
    const session = await factory.create({
      callSid: "CA" + "a".repeat(32),
      streamSid: "MZ" + "b".repeat(32),
      authorization: { tenantId: "tenant-123", callId: "call-123" },
      customParameters: {},
      sendAudio: frame => outputFrames.push(frame),
      sendMark: () => undefined,
      onError: error => errors.push(error),
    });

    for (let i = 0; i < 3; i++) session.receiveAudio(new Uint8Array(160).fill(0x00));
    for (let i = 0; i < 40; i++) session.receiveAudio(new Uint8Array(160).fill(0xff));
    await session.close();

    assert.match(llmSystemPrompt, /Business hours are 09:00 to 17:00/);
    assert.ok(outputFrames.length > 0, "expected synthesized audio frames");
    assert.ok(outputFrames.every(frame => frame.length === 160), "expected 20 ms PCMU frames");
    assert.deepEqual(errors, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
