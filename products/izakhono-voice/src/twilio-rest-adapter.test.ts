import { TwilioRestTelephonyAdapter } from "./twilio-rest-adapter";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let submitted: URLSearchParams | undefined;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    submitted = new URLSearchParams(String(init?.body ?? ""));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };

  const config = {
    accountSid: "AC" + "a".repeat(32),
    apiKeySid: "SK" + "b".repeat(32),
    apiKeySecret: "runtime-test-secret",
    fromNumber: "+27110000000",
    voiceWebhookUrl: "https://voice.example.test/twilio/voice",
    statusCallbackUrl: "https://voice.example.test/twilio/status",
    mediaStreamUrl: "wss://voice.example.test/twilio/stream",
  };
  try {
    const adapter = new TwilioRestTelephonyAdapter(config);
    const callSid = "CA" + "c".repeat(32);
    await adapter.answer(callSid);
    const twiml = submitted?.get("Twiml") ?? "";
    assert(twiml.includes('url="wss://voice.example.test/twilio/stream"'), "Stream URL was not kept query-free");
    assert(!twiml.includes("?"), "TwiML Stream URL unexpectedly contains a query string");
    assert(twiml.includes(`<Parameter name="callId" value="${callSid}"/>`), "Call association was not passed as a custom parameter");

    let rejected = false;
    try {
      new TwilioRestTelephonyAdapter({ ...config, mediaStreamUrl: "wss://voice.example.test/twilio/stream?callId=bad" });
    } catch {
      rejected = true;
    }
    assert(rejected, "A query-string Stream URL should be rejected at configuration time");
    console.log("IZAKHONO VOICE Twilio REST adapter tests passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
