import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const file = new URL("./data/za-curriculum-source-captures-2026-11.json", import.meta.url);
const dataset = JSON.parse(await readFile(file, "utf8"));

test("pilot curriculum source capture has traceable institution and qualification records", () => {
  assert.equal(dataset.institutions.length, 2);
  assert.equal(dataset.qualifications.length, 2);
  assert.ok(dataset.institutions.every(item => item.source.url && item.verification_status === "needs-review"));
  assert.ok(dataset.qualifications.every(item => item.source_url && item.verification_status === "needs-review"));
});

test("every pilot module has an official source and remains outside public verified discovery", () => {
  assert.ok(dataset.modules.length >= 10);
  assert.ok(dataset.modules.every(item => item.source_url && item.verification_status === "needs-review"));
  assert.equal(dataset.modules.some(item => item.verification_status === "verified"), false);
});

test("module codes are unique within the source capture", () => {
  const codes = dataset.modules.map(item => item.code);
  assert.equal(new Set(codes).size, codes.length);
});
