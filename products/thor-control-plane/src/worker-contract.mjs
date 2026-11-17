/**
 * THOR coding-worker safety contract.
 *
 * This module validates a work envelope before an executor receives it. It is
 * deliberately not a process sandbox: production execution must still use an
 * isolated ephemeral workspace/container with OS-level resource and network
 * controls. Never pass host credentials or unrestricted shell access.
 */

import { ThorError } from "./index.mjs";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;
const SAFE_COMMANDS = new Set(["npm test", "npm run test", "npm run lint", "npm run typecheck", "node --test"]);
const DENIED_PATHS = [
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.env($|\.)/i,
  /(^|\/)(secrets?|credentials?)(\/|$)/i,
  /(^|\/)id_rsa($|\.)/i,
  /(^|\/)\.ssh(\/|$)/i,
];

function assert(condition, message, code) {
  if (!condition) throw new ThorError(message, code);
}

export function validateWorkerEnvelope(input) {
  assert(input && typeof input === "object", "A worker envelope is required", "INVALID_ENVELOPE");
  const { taskId, projectId, repository, baseRef, workRef, allowedPaths, commands, limits } = input;
  assert(typeof taskId === "string" && SAFE_ID.test(taskId), "Invalid taskId", "INVALID_ENVELOPE");
  assert(typeof projectId === "string" && SAFE_ID.test(projectId), "Invalid projectId", "INVALID_ENVELOPE");
  assert(typeof repository === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), "Repository must be owner/name", "INVALID_REPOSITORY");
  assert(typeof baseRef === "string" && SAFE_REF.test(baseRef), "Invalid base ref", "INVALID_REF");
  assert(typeof workRef === "string" && SAFE_REF.test(workRef) && workRef !== baseRef, "Work ref must be a separate scoped branch", "INVALID_REF");
  assert(Array.isArray(allowedPaths) && allowedPaths.length > 0 && allowedPaths.length <= 100, "An explicit bounded path allow-list is required", "INVALID_PATH_SCOPE");
  for (const path of allowedPaths) {
    assert(typeof path === "string" && path.length <= 240 && !path.startsWith("/") && !path.split("/").includes(".."), "Unsafe path in allow-list", "INVALID_PATH_SCOPE");
    assert(!DENIED_PATHS.some(pattern => pattern.test(path)), "Sensitive paths cannot be in worker scope", "SENSITIVE_PATH_SCOPE");
  }
  assert(Array.isArray(commands) && commands.length > 0 && commands.length <= 12, "Explicit bounded commands are required", "INVALID_COMMANDS");
  for (const command of commands) assert(SAFE_COMMANDS.has(command), `Command is not allow-listed: ${command}`, "COMMAND_NOT_ALLOWED");
  assert(limits && Number.isInteger(limits.timeoutMs) && limits.timeoutMs >= 1_000 && limits.timeoutMs <= 900_000, "timeoutMs must be between 1000 and 900000", "INVALID_LIMITS");
  assert(Number.isInteger(limits.maxOutputBytes) && limits.maxOutputBytes >= 1_024 && limits.maxOutputBytes <= 5_000_000, "maxOutputBytes must be between 1024 and 5000000", "INVALID_LIMITS");
  assert(Number.isInteger(limits.maxChangedFiles) && limits.maxChangedFiles >= 1 && limits.maxChangedFiles <= 100, "maxChangedFiles must be between 1 and 100", "INVALID_LIMITS");
  return Object.freeze({
    taskId, projectId, repository, baseRef, workRef,
    allowedPaths: Object.freeze([...new Set(allowedPaths)]),
    commands: Object.freeze([...new Set(commands)]),
    limits: Object.freeze({ ...limits }),
    network: "disabled-by-default",
    credentials: "short-lived-scoped-token-only",
    productionDeploy: false,
    requiresReview: true,
  });
}

export function assertChangedPathsAllowed(changedPaths, envelope) {
  assert(Array.isArray(changedPaths), "Changed paths must be an array", "INVALID_CHANGESET");
  assert(changedPaths.length <= envelope.limits.maxChangedFiles, "Changed-file limit exceeded", "CHANGESET_TOO_LARGE");
  for (const path of changedPaths) {
    assert(typeof path === "string" && !path.startsWith("/") && !path.split("/").includes(".."), "Unsafe changed path", "INVALID_CHANGESET");
    assert(!DENIED_PATHS.some(pattern => pattern.test(path)), "Worker attempted to modify a sensitive path", "SENSITIVE_PATH_CHANGE");
    const allowed = envelope.allowedPaths.some(scope => path === scope || path.startsWith(scope.endsWith("/") ? scope : scope + "/"));
    assert(allowed, `Changed path is outside the task allow-list: ${path}`, "PATH_SCOPE_VIOLATION");
  }
  return true;
}
