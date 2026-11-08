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
    streamCredentialForCall: async () => "test-one-time-stream-credential",
  };
  try {
    const adapter = new TwilioRestTelephonyAdapter(config);
    const callSid = "CA" + "c".repeat(32);
    await adapter.answer(callSid);
    const twiml = submitted?.get("Twiml") ?? "";
    assert(twiml.includes('url="wss://voice.example.test/twilio/stream"'), "Stream URL was not kept query-free");
    assert(!twiml.includes("?"), "TwiML Stream URL unexpectedly contains a query string");
    assert(twiml.includes(`<Parameter name="callId" value="${callSid}"/>`), "Call association was not passed as a custom parameter");
    assert(twiml.includes(`<Parameter name="streamToken" value="test-one-time-stream-credential"/>`), "One-time stream credential was not passed as a custom parameter");

    await adapter.dial("+27123456789", "11111111-1111-4111-8111-111111111111");
    const outboundUrl = new URL(submitted?.get("Url") ?? "https://invalid.example");
    assert(outboundUrl.searchParams.get("callId") === "11111111-1111-4111-8111-111111111111", "Outbound webhook did not carry the signed internal call reference");
    assert(submitted?.get("StatusCallback") === config.statusCallbackUrl, "Status callback URL should remain canonical and query-free");

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
