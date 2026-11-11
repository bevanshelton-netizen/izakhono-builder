import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyTwilioWebSocketHandshake } from "./twilio-websocket-security.js";

const canonicalPublicUrl = "wss://voice.example.com/twilio/media";
const authToken = "test-runtime-secret";
const signature = createHmac("sha1", authToken).update(canonicalPublicUrl).digest("base64");

test("accepts a correctly signed canonical Twilio WebSocket upgrade", () => {
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media", signature, canonicalPublicUrl, authToken,
  }), true);
});

test("rejects an invalid signature", () => {
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media", signature: "invalid", canonicalPublicUrl, authToken,
  }), false);
});

test("rejects a different path and all query strings", () => {
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/other", signature, canonicalPublicUrl, authToken,
  }), false);
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media?tenant=untrusted", signature, canonicalPublicUrl, authToken,
  }), false);
});

test("rejects insecure or query-bearing configured public URLs", () => {
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media", signature,
    canonicalPublicUrl: "ws://voice.example.com/twilio/media", authToken,
  }), false);
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media", signature,
    canonicalPublicUrl: "wss://voice.example.com/twilio/media?x=1", authToken,
  }), false);
});

test("accepts Twilio's documented trailing-slash WSS signature variant", () => {
  const slashSignature = createHmac("sha1", authToken).update(`${canonicalPublicUrl}/`).digest("base64");
  assert.equal(verifyTwilioWebSocketHandshake({
    method: "GET", requestUrl: "/twilio/media", signature: slashSignature, canonicalPublicUrl, authToken,
  }), true);
});
