import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ClamAVEvidenceScanner,
  type ClamAVTransport,
} from "./evidence-scanner.ts";

const bytes = new TextEncoder().encode("safe test evidence");
const digest = createHash("sha256").update(bytes).digest("hex");

test("unconfigured scanner fails closed", async () => {
  const result = await new ClamAVEvidenceScanner().scan(bytes, digest);
  assert.equal(result.status, "not_configured");
  assert.equal(result.code, "SCANNER_NOT_CONFIGURED");
});

test("clean scan returns a matching evidence digest and signature version", async () => {
  const transport: ClamAVTransport = {
    scan: async () => ({ status: "clean", signatureVersion: "test-signatures-1" }),
  };
  const result = await new ClamAVEvidenceScanner(transport).scan(bytes, digest);
  assert.equal(result.status, "clean");
  assert.equal(result.sha256, digest);
  assert.equal(result.signatureVersion, "test-signatures-1");
  assert.ok(result.scannedAt);
});

test("infected evidence is identified and must not be stored", async () => {
  const transport: ClamAVTransport = {
    scan: async () => ({ status: "infected", signatureVersion: "test-signatures-1" }),
  };
  const result = await new ClamAVEvidenceScanner(transport).scan(bytes, digest);
  assert.equal(result.status, "infected");
  assert.equal(result.code, "MALWARE_DETECTED");
});

test("scanner transport failure fails closed", async () => {
  const transport: ClamAVTransport = {
    scan: async () => { throw new Error("scanner offline"); },
  };
  const result = await new ClamAVEvidenceScanner(transport).scan(bytes, digest);
  assert.equal(result.status, "error");
  assert.equal(result.code, "SCANNER_ERROR");
});

test("hash mismatch prevents scanner execution", async () => {
  let invoked = false;
  const transport: ClamAVTransport = {
    scan: async () => {
      invoked = true;
      return { status: "clean", signatureVersion: "test-signatures-1" };
    },
  };
  const result = await new ClamAVEvidenceScanner(transport).scan(bytes, "0".repeat(64));
  assert.equal(result.status, "error");
  assert.equal(result.code, "EVIDENCE_HASH_MISMATCH");
  assert.equal(invoked, false);
});
