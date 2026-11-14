export type GitHubCheckNameMap = {
  typecheck: string[];
  "unit-tests": string[];
  manifest: string[];
};

export type GitHubBuildVerifierOptions = {
  token: string;
  allowedRepositories: readonly string[];
  checks?: GitHubCheckNameMap;
  fetcher?: typeof fetch;
};

// GitHub exposes the Registry workflow as one aggregate job check named "registry".
 // That job succeeds only after its configured typecheck and test steps all succeed;
 // the two input groups therefore intentionally reference the same aggregate proof.
const DEFAULT_CHECKS: GitHubCheckNameMap = {
  typecheck: ["registry"],
  "unit-tests": ["registry"],
  manifest: ["Validate application manifests"],
};

type GitHubCheckRun = { name?: string; status?: string; conclusion?: string };
type GitHubCheckResponse = { total_count?: number; check_runs?: GitHubCheckRun[] };

export function createGitHubReadOnlyBuildVerifier(options: GitHubBuildVerifierOptions) {
  if (!options.token.trim()) throw new Error("github_token_required");
  const allowed = new Set(options.allowedRepositories.map(value => value.toLowerCase()));
  if (!allowed.size) throw new Error("repository_allowlist_required");
  const fetcher = options.fetcher ?? fetch;
  const checks = options.checks ?? DEFAULT_CHECKS;

  return async (request: {
    repository: string;
    revision: string;
    checks: readonly ("typecheck" | "unit-tests" | "manifest")[];
  }) => {
    const repository = request.repository.toLowerCase();
    if (!allowed.has(repository)) throw new Error("repository_not_allowlisted");
    const url = `https://api.github.com/repos/${request.repository}/commits/${request.revision}/check-runs?per_page=100`;
    const response = await fetcher(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "IZAKHONO-ReadOnly-Build-Verifier",
      },
    });
    if (!response.ok) throw new Error(`github_check_runs_http_${response.status}`);
    const data = await response.json() as GitHubCheckResponse;
    const runs = Array.isArray(data.check_runs) ? data.check_runs : [];
    const results = request.checks.map(key => {
      const requiredNames = checks[key];
      const selected = runs.filter(run => typeof run.name === "string" && requiredNames.includes(run.name));
      const missing = requiredNames.filter(name => !selected.some(run => run.name === name));
      const pending = selected.filter(run => run.status !== "completed");
      const failed = selected.filter(run => run.status === "completed" && run.conclusion !== "success");
      const passed = missing.length === 0 && pending.length === 0 && failed.length === 0;
      const detail = passed
        ? `All required GitHub checks passed for ${request.revision}`
        : [
            missing.length ? `missing: ${missing.join(", ")}` : "",
            pending.length ? `pending: ${pending.map(run => run.name).join(", ")}` : "",
            failed.length ? `not successful: ${failed.map(run => `${run.name}=${run.conclusion ?? "unknown"}`).join(", ")}` : "",
          ].filter(Boolean).join("; ");
      return { name: key, passed, detail };
    });
    return {
      summary: "Read-only GitHub Actions check-run verification",
      revision: request.revision,
      checks: results,
    };
  };
}
