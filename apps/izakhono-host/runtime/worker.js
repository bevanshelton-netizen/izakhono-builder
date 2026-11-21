import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createArtifactStore } from "./artifact-store.js";

const timeoutMs = Number(process.env.IZAKHONO_BUILD_TIMEOUT_MS || 10 * 60 * 1000);
const workspaceRoot = path.resolve(process.env.IZAKHONO_BUILD_WORKSPACE || path.join(os.tmpdir(), "izakhono-builds"));
const artifactRoot = path.resolve(process.env.IZAKHONO_ARTIFACT_ROOT || path.join(process.cwd(), ".artifacts"));

function safeId(value) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(id)) throw new Error("invalid_job_id");
  return id;
}

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("build_timeout"));
    }, timeoutMs);
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr }); });
  });
}

export async function executeBuild(job) {
  const jobId = safeId(job.id || crypto.randomUUID());
  const workspace = fs.mkdtempSync(path.join(workspaceRoot, `${jobId}-`));
  const artifacts = createArtifactStore(artifactRoot);
  const startedAt = new Date().toISOString();
  try {
    if (!job.sourceDir) throw new Error("source_dir_required");
    fs.cpSync(path.resolve(job.sourceDir), workspace, { recursive: true, filter: source => !source.includes(`${path.sep}.git${path.sep}`) });
    const command = job.command || "npm";
    const args = Array.isArray(job.args) ? job.args.map(String) : ["run", "build"];
    const env = {
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
      NODE_ENV: "production",
      CI: "1",
      IZAKHONO_BUILD_JOB: jobId
    };
    const result = await run(command, args, workspace, env);
    if (result.code !== 0) throw new Error(`build_failed:${result.code}`);
    const outputDir = path.resolve(workspace, job.outputDir || "dist");
    if (!outputDir.startsWith(`${workspace}${path.sep}`) || !fs.existsSync(outputDir)) throw new Error("build_output_missing");
    const files = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) {
          const bytes = fs.readFileSync(full);
          const stored = artifacts.put(bytes);
          files.push({ path: path.relative(outputDir, full), digest: stored.digest, bytes: stored.bytes });
        }
      }
    };
    walk(outputDir);
    return { ok: true, job_id: jobId, state: "built", started_at: startedAt, finished_at: new Date().toISOString(), artifact_count: files.length, files, stdout: result.stdout.slice(-20000), stderr: result.stderr.slice(-20000) };
  } catch (error) {
    return { ok: false, job_id: jobId, state: "failed", started_at: startedAt, finished_at: new Date().toISOString(), error: error.message };
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  console.error("IZAKHONO HOST native worker library loaded; submit jobs through the HOST runtime adapter.");
}
