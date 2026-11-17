/**
 * Ephemeral Docker sandbox for THOR coding workers.
 *
 * This module copies a source tree without Git metadata or credentials, then
 * executes only validated commands in a network-isolated, read-only-root
 * container. It never mounts the Docker socket or host environment into the
 * sandbox. The returned workspace is disposable and must be cleaned up.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ThorError } from "./index.mjs";
import { assertChangedPathsAllowed, validateWorkerEnvelope } from "./worker-contract.mjs";

const IMAGE = "node:22-bookworm-slim";
const MAX_FILES = 50_000;
const MAX_SOURCE_BYTES = 1_000_000_000;
const DENIED_SEGMENTS = new Set([
  ".git", ".ssh", ".vercel", ".wrangler", ".aws", ".azure", ".gcloud",
  ".npmrc", "node_modules", "secrets", "secret", "credentials",
]);

function deniedCopyPath(name) {
  return DENIED_SEGMENTS.has(name.toLowerCase())
    || /^\.env(?:\.|$)/i.test(name)
    || /\.(pem|key|p12|pfx)$/i.test(name);
}

async function copyTree(source, destination) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (deniedCopyPath(entry.name)) continue;
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    const stat = await lstat(from);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      await copyTree(from, to);
    } else if (stat.isFile()) {
      await mkdir(dirname(to), { recursive: true, mode: 0o700 });
      await copyFile(from, to);
      await chmod(to, stat.mode & 0o777);
    }
  }
}

async function hashTree(root) {
  const files = new Map();
  let totalBytes = 0;
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new ThorError("Sandbox created a symbolic link", "SYMLINK_CHANGE_NOT_ALLOWED");
      if (stat.isDirectory()) {
        await walk(absolute);
      } else if (stat.isFile()) {
        totalBytes += stat.size;
        if (files.size >= MAX_FILES || totalBytes > MAX_SOURCE_BYTES) {
          throw new ThorError("Sandbox workspace exceeded file or size ceiling", "SANDBOX_WORKSPACE_LIMIT");
        }
        const bytes = await readFile(absolute);
        const digest = createHash("sha256")
          .update(String(stat.mode & 0o777))
          .update(bytes)
          .digest("hex");
        files.set(relative(root, absolute).split(sep).join("/"), digest);
      } else {
        throw new ThorError("Sandbox created an unsupported filesystem object", "UNSAFE_FILESYSTEM_OBJECT");
      }
    }
  }
  await walk(root);
  return files;
}

function runDocker(args, { dockerBinary, spawnImpl, timeoutMs, maxOutputBytes }) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    let settled = false;
    let output = "";
    let outputBytes = 0;
    const finishError = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child?.kill("SIGKILL"); } catch {}
      rejectPromise(error);
    };
    try {
      child = spawnImpl(dockerBinary, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
    } catch {
      rejectPromise(new ThorError("Docker sandbox could not be started", "SANDBOX_UNAVAILABLE"));
      return;
    }
    const timer = setTimeout(() => finishError(new ThorError("Sandbox command timed out", "SANDBOX_TIMEOUT")), timeoutMs);
    const collect = chunk => {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        finishError(new ThorError("Sandbox output limit exceeded", "OUTPUT_LIMIT_EXCEEDED"));
        return;
      }
      output += chunk.toString("utf8");
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    child.on("error", () => finishError(new ThorError("Docker sandbox runtime is unavailable", "SANDBOX_UNAVAILABLE")));
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: Number.isInteger(code) ? code : 1, signal: signal || null, output });
    });
  });
}

async function readonlyNodeModules(sourcePath) {
  const candidate = join(sourcePath, "node_modules");
  try {
    const stat = await lstat(candidate);
    return stat.isDirectory() && !stat.isSymbolicLink() ? candidate : null;
  } catch {
    return null;
  }
}

export async function runDockerSandbox({
  sourcePath,
  workerEnvelope,
  dockerBinary = "docker",
  spawnImpl = spawn,
  uid = process.getuid?.() ?? 1000,
  gid = process.getgid?.() ?? 1000,
} = {}) {
  const envelope = validateWorkerEnvelope(workerEnvelope);
  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    throw new ThorError("A source workspace path is required", "INVALID_WORKSPACE");
  }
  const source = resolve(sourcePath);
  let sourceStat;
  try { sourceStat = await lstat(source); } catch {
    throw new ThorError("Source workspace does not exist", "INVALID_WORKSPACE");
  }
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new ThorError("Source workspace must be a real directory", "INVALID_WORKSPACE");
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "thor-sandbox-"));
  const workspacePath = join(tempRoot, "workspace");
  try {
    await copyTree(source, workspacePath);
    const before = await hashTree(workspacePath);
    const nodeModulesPath = await readonlyNodeModules(source);
    const deadline = Date.now() + envelope.limits.timeoutMs;
    let totalOutputBytes = 0;
    const tests = [];

    for (const command of envelope.commands) {
      const remainingMs = deadline - Date.now();
      const remainingOutput = envelope.limits.maxOutputBytes - totalOutputBytes;
      if (remainingMs <= 0) throw new ThorError("Sandbox task timed out", "SANDBOX_TIMEOUT");
      if (remainingOutput <= 0) throw new ThorError("Sandbox output limit exceeded", "OUTPUT_LIMIT_EXCEEDED");

      const args = [
        "run", "--rm",
        "--network", "none",
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--pids-limit", "128",
        "--memory", `${envelope.limits.memoryMb}m`,
        "--cpus", String(envelope.limits.cpuCount),
        "--user", `${uid}:${gid}`,
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m",
        "--env", "CI=1",
        "--env", "NODE_ENV=test",
        "--env", "HOME=/tmp",
        "--env", "TMPDIR=/tmp",
        "--mount", `type=bind,src=${workspacePath},dst=/workspace,rw`,
      ];
      if (nodeModulesPath) args.push("--mount", `type=bind,src=${nodeModulesPath},dst=/workspace/node_modules,readonly`);
      args.push("--workdir", "/workspace", "--entrypoint", "/bin/sh", IMAGE, "-lc", command);

      const started = Date.now();
      const result = await runDocker(args, {
        dockerBinary, spawnImpl, timeoutMs: remainingMs, maxOutputBytes: remainingOutput,
      });
      const durationMs = Date.now() - started;
      totalOutputBytes += Buffer.byteLength(result.output);
      tests.push(Object.freeze({
        command,
        exitCode: result.exitCode,
        durationMs,
        output: result.output,
      }));
    }

    const after = await hashTree(workspacePath);
    const allPaths = new Set([...before.keys(), ...after.keys()]);
    const changedFiles = [...allPaths].filter(path => before.get(path) !== after.get(path)).sort();
    if (changedFiles.length === 0) throw new ThorError("Sandbox produced no file changes", "NO_CHANGES");
    assertChangedPathsAllowed(changedFiles, envelope);
    const artifactDigest = createHash("sha256")
      .update(JSON.stringify(changedFiles.map(path => [path, after.get(path) ?? "deleted"])))
      .digest("hex");

    return Object.freeze({
      workspacePath,
      changedFiles: Object.freeze(changedFiles),
      artifactDigest,
      tests: Object.freeze(tests),
      success: tests.every(test => test.exitCode === 0),
      cleanup: () => rm(tempRoot, { recursive: true, force: true }),
    });
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}
