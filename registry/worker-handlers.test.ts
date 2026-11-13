import { strict as assert } from "node:assert";
import type { SupervisorJob } from "./supervisor-store";
import { createBuildWorkerHandler } from "./worker-handlers";

const job = (input: unknown): SupervisorJob => ({
  id: "build:1", source: "test", sourceId: "1", title: "Validate repository",
  workerId: "build-worker", priority: 1, risk: "low", status: "running",
  dependencyIds: [], attempts: 1, input, evidence: {}, createdAt: "now", updatedAt: "now",
});

async function main() {
  let called = 0;
  const handler = createBuildWorkerHandler(async request => {
    called++;
    assert.equal(request.repository, "bevanshelton-netizen/izakhono-builder");
    assert.equal(request.revision, "abcdef1234567");
    assert.equal(request.idempotencyKey, "idem-1");
    return {
      summary: "Read-only validation completed",
      revision: request.revision,
      checks: request.checks.map(name => ({ name, passed: true, detail: "Verifier reported success" })),
    };
  });
  const result = await handler(job({
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    checks: ["typecheck", "unit-tests"],
  }), { attempt: 1, idempotencyKey: "idem-1" });
  assert.equal(called, 1);
  assert.equal(result.checks.length, 2);
  assert.equal(result.checks.every(check => check.passed), true);
  assert.deepEqual(result.artifact, {
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    verificationOnly: true,
  });

  await assert.rejects(() => handler(job({
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    checks: ["deploy"],
  }), { attempt: 1, idempotencyKey: "idem-2" }), /not_allowlisted/);

  const incomplete = createBuildWorkerHandler(async request => ({
    summary: "Incomplete report",
    revision: request.revision,
    checks: [],
  }));
  await assert.rejects(() => incomplete(job({
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    checks: ["typecheck"],
  }), { attempt: 1, idempotencyKey: "idem-3" }), /incomplete/);

  console.log("build worker tests: ok (allowlisted checks, revision binding, bounded verifier)");
}
void main();
