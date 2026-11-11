import { strict as assert } from "node:assert";
import { AzureSpeechAdapter } from "./azure-speech.js";

let request: RequestInit | undefined;
const adapter = new AzureSpeechAdapter({
  subscriptionKey: "test-secret",
  region: "southafricanorth",
  voices: { "za-executive-warm-f": { name: "en-ZA-LeahNeural", locale: "en-ZA" } },
  fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
    request = init;
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200, headers: { "content-type": "audio/mpeg" },
    });
  }) as typeof fetch,
});
const result = await adapter.synthesize({
  text: "Hello <IZAKHONO> & welcome",
  voiceKey: "za-executive-warm-f",
  locale: "en-ZA",
  speechRate: 1,
  style: "executive",
});
assert.equal(result.contentType, "audio/mpeg");
assert.equal(result.audio.length, 3);
assert.match(String(request?.body), /&lt;IZAKHONO&gt; &amp; welcome/);
assert.equal((request?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"], "test-secret");
await assert.rejects(() => adapter.synthesize({
  text: "Hello", voiceKey: "not-configured", locale: "en-ZA", speechRate: 1, style: "executive",
}), /speech-voice-not-configured/);
await assert.rejects(() => adapter.synthesize({
  text: "Hello", voiceKey: "za-executive-warm-f", locale: "zu-ZA", speechRate: 1, style: "executive",
}), /speech-locale-voice-mismatch/);
console.log("IZAKHONO Azure Speech adapter tests passed");
