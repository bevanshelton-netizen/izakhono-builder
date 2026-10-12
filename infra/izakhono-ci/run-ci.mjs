#!/usr/bin/env node
/** IZAKHONO CI — owned runner entrypoint. */
import { spawn } from "node:child_process";

const commands = [
  ["node", ["--check", "infra/mail-stack/engine/node01-mail-orchestrator.mjs"]],
  ["node", ["infra/mail-stack/engine/node01-mail-orchestrator.test.mjs"]],
  ["node", ["infra/mail-stack/engine/node01-durable-mail-runtime.test.mjs"]],
  ["node", ["infra/mail-stack/mail-processor.test.mjs"]],
  ["node", ["infra/mail-stack/engine/engine.test.mjs"]],
  ["node", ["infra/mail-stack/verify.mjs"]],
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)));
  });
}

for (const [command, args] of commands) await run(command, args);
console.log("IZAKHONO CI PASSED");
