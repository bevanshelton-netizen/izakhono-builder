import { verifyTwilioWebhook } from "./twilio-webhook-security";

async function sign(token: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function main(): Promise<void> {
  const token = "test-auth-token";
  const publicUrl = "https://voice.example.test/webhooks/twilio/voice?tenant=demo";
  const params = { CallSid: "CA123", From: "+27110000000", To: "+27210000000", CallStatus: "ringing" };
  const canonical = publicUrl + Object.keys(params).sort().map((key) => key + params[key]).join("");
  const signature = await sign(token, canonical);

  const valid = await verifyTwilioWebhook({ authToken: token, signature, publicUrl, params });
  if (!valid) throw new Error("Expected valid Twilio signature to pass");

  const invalid = await verifyTwilioWebhook({ authToken: token, signature: "invalid", publicUrl, params });
  if (invalid) throw new Error("Expected invalid Twilio signature to fail");

  const altered = await verifyTwilioWebhook({
    authToken: token,
    signature,
    publicUrl,
    params: { ...params, From: "+27119999999" },
  });
  if (altered) throw new Error("Expected modified webhook parameters to fail");

  const missing = await verifyTwilioWebhook({ authToken: token, signature: null, publicUrl, params });
  if (missing) throw new Error("Expected missing signature to fail");

  console.log("IZAKHONO VOICE Twilio webhook security tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
