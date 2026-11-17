import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runDockerSandbox } from "./sandbox.mjs";

test("Docker sandbox enforces network isolation, resource limits and changed-path scope", async t => {
  const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (docker.status !== 0) {
    t.skip("Docker daemon is unavailable in this environment");
    return;
  }

  const sourcePath = await mkdtemp(join(tmpdir(), "thor-sandbox-source-"));
  let result;
  try {
    await mkdir(join(sourcePath, "tests"), { recursive: true });
    await mkdir(join(sourcePath, ".git"), { recursive: true });
    await mkdir(join(sourcePath, "secrets"), { recursive: true });
    await writeFile(join(sourcePath, ".env"), "SHOULD_NOT_ENTER_SANDBOX=secret");
    await writeFile(join(sourcePath, ".git", "config"), "[remote]\\nurl=private");
    await writeFile(join(sourcePath, "secrets", "token.txt"), "secret-token");
    await writeFile(join(sourcePath, "tests", "sandbox-check.test.mjs"), `
      import assert from "node:assert/strict";
      import { writeFile } from "node:fs/promises";
      import test from "node:test";
      test("writes only the scoped output", async () => {
        await writeFile("generated.txt", "sandbox-output");
      });
      test("cannot reach the public internet", async () => {
        await assert.rejects(fetch("https://example.com", { signal: AbortSignal.timeout(500) }));
      });
    `);
    result = await runDockerSandbox({
      sourcePath,
      workerEnvelope: {
        taskId: "sandbox-01",
        projectId: "thor",
        repository: "bevanshelton-netizen/izakhono-builder",
        baseRef: "main",
        workRef: "thor/sandbox-01",
        allowedPaths: ["generated.txt"],
        commands: ["node --test"],
        limits: {
          timeoutMs: 120000,
          maxOutputBytes: 200000,
          maxChangedFiles: 5,
          memoryMb: 512,
          cpuCount: 1,
        },
      },
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.changedFiles, ["generated.txt"]);
    assert.equal(result.tests.length, 1);
    assert.equal(result.tests[0].exitCode, 0);
    assert.match(result.artifactDigest, /^[a-f0-9]{64}$/);
    assert.equal(await readFile(join(result.workspacePath, "generated.txt"), "utf8"), "sandbox-output");
    await assert.rejects(access(join(result.workspacePath, ".env")));
    await assert.rejects(access(join(result.workspacePath, ".git")));
    await assert.rejects(access(join(result.workspacePath, "secrets")));
  } finally {
    await result?.cleanup();
    await rm(sourcePath, { recursive: true, force: true });
  }
});


test("Docker sandbox rejects changes outside the task allow-list", async t => {
  const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (docker.status !== 0) {
    t.skip("Docker daemon is unavailable in this environment");
    return;
  }
  const sourcePath = await mkdtemp(join(tmpdir(), "thor-sandbox-scope-"));
  try {
    await mkdir(join(sourcePath, "tests"), { recursive: true });
    await writeFile(join(sourcePath, "tests", "scope-check.test.mjs"), `
      import { writeFile } from "node:fs/promises";
      import test from "node:test";
      test("attempts an out-of-scope file change", async () => {
        await writeFile("outside.txt", "must-be-rejected");
      });
    `);
    await assert.rejects(
      runDockerSandbox({
        sourcePath,
        workerEnvelope: {
          taskId: "sandbox-scope-01",
          projectId: "thor",
          repository: "bevanshelton-netizen/izakhono-builder",
          baseRef: "main",
          workRef: "thor/sandbox-scope-01",
          allowedPaths: ["generated.txt"],
          commands: ["node --test"],
          limits: {
            timeoutMs: 120000,
            maxOutputBytes: 200000,
            maxChangedFiles: 5,
            memoryMb: 512,
            cpuCount: 1,
          },
        },
      }),
      error => error.code === "PATH_SCOPE_VIOLATION",
    );
  } finally {
    await rm(sourcePath, { recursive: true, force: true });
  }
});
