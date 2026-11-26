import assert from "node:assert/strict";
import test from "node:test";
import { validateBrowserRedirect, validateBrowserUrl, validateReadOnlyBrowserTask } from "./url-policy.mjs";

test("accepts public HTTPS and normalizes URL", () => {
  const result = validateBrowserUrl("https://example.com/path");
  assert.equal(result.ok, true);
  assert.equal(result.origin, "https://example.com");
});

test("rejects non-HTTPS public URLs", () => {
  assert.equal(validateBrowserUrl("http://example.com").reason, "https_required");
});

test("rejects dangerous protocols and malformed URLs", () => {
  assert.equal(validateBrowserUrl("file:///etc/passwd").reason, "unsupported_protocol");
  assert.equal(validateBrowserUrl("not a url").reason, "malformed_url");
});

test("rejects embedded credentials", () => {
  assert.equal(validateBrowserUrl("https://user:pass@example.com").reason, "embedded_credentials");
});

test("blocks loopback and private network targets", () => {
  assert.equal(validateBrowserUrl("https://127.0.0.1").reason, "loopback_blocked");
  assert.equal(validateBrowserUrl("https://10.0.0.5").reason, "private_ip_blocked");
  assert.equal(validateBrowserUrl("https://192.168.1.10").reason, "private_ip_blocked");
  assert.equal(validateBrowserUrl("https://service.local").reason, "non_public_hostname");
});

test("allows HTTP loopback only for explicit local fixtures", () => {
  assert.equal(validateBrowserUrl("http://127.0.0.1:4173", { allowLocalFixtures: true }).ok, true);
  assert.equal(validateBrowserUrl("http://127.0.0.1:4173").ok, false);
  assert.equal(validateBrowserUrl("http://example.com", { allowLocalFixtures: true }).ok, false);
});

test("blocks cross-origin redirects", () => {
  assert.equal(validateBrowserRedirect("https://example.com/a", "https://example.com/b").ok, true);
  assert.equal(validateBrowserRedirect("https://example.com/a", "https://evil.example").reason, "cross_origin_redirect_blocked");
  assert.equal(validateBrowserRedirect("https://example.com/a", "http://127.0.0.1").ok, false);
});

test("enforces read-only task schema and bounded options", () => {
  assert.equal(validateReadOnlyBrowserTask({ type: "extract_text", url: "https://example.com" }).ok, true);
  assert.equal(validateReadOnlyBrowserTask({ type: "click", url: "https://example.com" }).reason, "unsupported_task_type");
  assert.equal(validateReadOnlyBrowserTask({ type: "navigate", url: "https://example.com", submit: true }).reason, "unknown_task_field");
  assert.equal(validateReadOnlyBrowserTask({ type: "navigate", url: "https://example.com", maxPages: 99 }).reason, "page_limit_out_of_range");
});
