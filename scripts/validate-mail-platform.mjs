#!/usr/bin/env node
/**
 * Unified IZAKHONO mail validation.
 * Local/CI-only: no DNS mutation, external delivery, secrets, or deployment.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const engineDir = path.join(root, "infra/mail-stack");
const tests = [];

function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) tests.push(path.relative(root, full));
  }
}

function run(label, command, args) {
  console.log("\n=== " + label + " ===");
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    timeout: 180_000,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
    return false;
  }
  if (result.status !== 0) {
    console.error(label + " FAILED with exit status " + result.status);
    process.exitCode = result.status || 1;
    return false;
  }
  console.log(label + " PASSED");
  return true;
}

if (!fs.existsSync(path.join(engineDir, "verify.mjs"))) {
  console.error("Missing infra/mail-stack/verify.mjs");
  process.exit(1);
}
collect(engineDir);
tests.sort();

let ok = true;
ok = run("Portfolio mail identity and domain policy", process.execPath, ["infra/mail-stack/verify.mjs"]) && ok;
ok = run("IZAKHONO mail engine validation", "npm", ["run", "mail:validate"]) && ok;
ok = run("Mail stack contract tests (" + tests.length + " files)", process.execPath, ["--test", ...tests]) && ok;
ok = run("IZAKHONO Mail product tests", "npm", ["--prefix", "products/izakhono-mail", "test"]) && ok;

console.log("\n=== RESULT ===");
console.log(ok ? "IZAKHONO MAIL SOFTWARE VALIDATION PASSED." : "IZAKHONO MAIL SOFTWARE VALIDATION FAILED.");
console.log("This validates repository software only. It does not prove public DNS, SMTP reachability, deliverability, mailbox login, backup restoration, or production readiness.");
process.exitCode = ok ? 0 : (process.exitCode || 1);
