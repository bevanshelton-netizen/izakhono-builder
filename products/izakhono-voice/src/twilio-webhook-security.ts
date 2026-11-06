const encoder = new TextEncoder();

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verify an inbound Twilio form webhook.
 *
 * Pass the exact externally configured webhook URL (including query string),
 * not a URL reconstructed from an untrusted Host or forwarded-host header.
 * Values must be the decoded form values supplied by the URL-encoded parser.
 */
export async function verifyTwilioWebhook(input: {
  authToken: string;
  signature: string | null;
  publicUrl: string;
  params: Record<string, string>;
}): Promise<boolean> {
  if (!input.authToken || !input.signature || !input.publicUrl) return false;

  const canonical = input.publicUrl + Object.keys(input.params)
    .sort()
    .map((key) => key + input.params[key])
    .join("");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(canonical));
  return safeEqual(toBase64(digest), input.signature);
}
