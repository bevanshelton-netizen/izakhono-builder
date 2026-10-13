import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrainPersistence } from "./brain-persistence.js";
import { BrainKernel, healthPolicy } from "./brain-kernel.js";

const dir = mkdtempSync(join(tmpdir(), "izakhono-brain-"));
const store = new BrainPersistence(join(dir, "state.json"));
const registry = [{ id: "mail" }];
const policies = { mail: healthPolicy };

const first = new BrainKernel({ registry, policies, persistence: store, clock: () => "T1" });
first.decide({ brain: "mail", intent: "test" });
assert.equal(first.status().auditEntries, 1);

const second = new BrainKernel({ registry, policies, persistence: store, clock: () => "T2" });
assert.equal(second.status().auditEntries, 1);
assert.equal(second.audit[0].intent, "test");

rmSync(dir, { recursive: true, force: true });
console.log("IZAKHONO Brain persistence tests PASSED");
