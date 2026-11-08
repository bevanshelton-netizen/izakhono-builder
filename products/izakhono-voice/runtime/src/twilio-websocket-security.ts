import { createHmac, timingSafeEqual } from "node:crypto";

export interface TwilioHandshakeInput {
  method: string;
  requestUrl: string;
  signature: string | undefined;
  canonicalPublicUrl: string;
  authToken: string;
}

/**
 * Validates the initial Twilio Media Streams WebSocket HTTP upgrade.
 * The public URL is configured out-of-band; Host and forwarded headers are
 * deliberately never used to construct the signature input.
 *
 * Media Streams custom parameters arrive later in the start event and are
 * therefore not part of this handshake signature.
 */
export function verifyTwilioWebSocketHandshake(input: TwilioHandshakeInput): boolean {
  if (input.method.toUpperCase() !== "GET" || !input.signature || !input.authToken) return false;

  let canonical: URL;
  let request: URL;
  try {
    canonical = new URL(input.canonicalPublicUrl);
    request = new URL(input.requestUrl, "http://runtime.invalid");
  } catch {
    return false;
  }

  if (canonical.protocol !== "wss:" || canonical.search || canonical.hash ||
      canonical.username || canonical.password || request.search || request.hash ||
      request.pathname !== canonical.pathname) return false;

  const suppliedBytes = Buffer.from(input.signature, "utf8");
  const canonicalCandidates = [canonical.toString()];
  // Twilio's security guidance notes that WSS handshake validation may require
  // a trailing slash. Try that documented variant without trusting request headers.
  if (!canonical.pathname.endsWith("/")) canonicalCandidates.push(`${canonical.toString()}/`);

  return canonicalCandidates.some(candidate => {
    const expectedBytes = Buffer.from(
      createHmac("sha1", input.authToken).update(candidate).digest("base64"),
      "utf8",
    );
    return suppliedBytes.length === expectedBytes.length &&
      timingSafeEqual(suppliedBytes, expectedBytes);
  });
}
