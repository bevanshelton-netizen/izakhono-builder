import { strict as assert } from "node:assert";
import { createGitHubReadOnlyBuildVerifier } from "./github-build-verifier";

async function main() {
  let requestedUrl = "";
  const verifier = createGitHubReadOnlyBuildVerifier({
    token: "test-token",
    allowedRepositories: ["bevanshelton-netizen/izakhono-builder"],
    checks: {
      typecheck: ["registry:typecheck"],
      "unit-tests": ["registry:lease-test", "registry:executor-test"],
      manifest: ["manifest-check"],
    },
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      assert.equal(init?.method, "GET");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-token");
      return new Response(JSON.stringify({
        total_count: 4,
        check_runs: [
          { name: "registry:typecheck", status: "completed", conclusion: "success" },
          { name: "registry:lease-test", status: "completed", conclusion: "success" },
          { name: "registry:executor-test", status: "completed", conclusion: "success" },
          { name: "manifest-check", status: "completed", conclusion: "failure" },
        ],
      }), { status: 200 });
    },
  });
  const result = await verifier({
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    checks: ["typecheck", "unit-tests", "manifest"],
  });
  assert.match(requestedUrl, /commits\/abcdef1234567\/check-runs/);
  assert.deepEqual(result.checks.map(check => check.passed), [true, true, false]);
  await assert.rejects(() => verifier({
    repository: "other/repository",
    revision: "abcdef1234567",
    checks: ["typecheck"],
  }), /repository_not_allowlisted/);

  const pendingVerifier = createGitHubReadOnlyBuildVerifier({
    token: "test-token",
    allowedRepositories: ["bevanshelton-netizen/izakhono-builder"],
    checks: { typecheck: ["registry:typecheck"], "unit-tests": ["unit"], manifest: ["manifest"] },
    fetcher: async () => new Response(JSON.stringify({
      check_runs: [{ name: "registry:typecheck", status: "in_progress", conclusion: null }],
    }), { status: 200 }),
  });
  const pending = await pendingVerifier({
    repository: "bevanshelton-netizen/izakhono-builder",
    revision: "abcdef1234567",
    checks: ["typecheck"],
  });
  assert.equal(pending.checks[0].passed, false);
  assert.match(pending.checks[0].detail, /pending/);
  console.log("GitHub build verifier tests: ok (repository allowlist, commit binding, pass/fail/pending)");
}
void main();
