import assert from "node:assert/strict";
import { createNode01MailReadinessProbes } from "./node01-mail-readiness-factory.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { state: "running" };
const persistence = { configured: true };
const probes = createNode01MailReadinessProbes({
  domain: "gmail.com",
  mailHost: "smtp.gmail.com",
  runtime,
  server,
  persistence,
  registry: { dkimSelectors: ["google"] },
});

assert.equal((await probes.runtime()).ok, true);
assert.equal((await probes.dkim()).ok, true);
assert.equal((await probes.persistence()).ok, true);
assert.equal((await probes.identities()).ok, false);

const spf = await probes.spf();
assert.equal(spf.ok, true);
assert.equal(spf.source, "node01-mail-probe:spf");

console.log("NODE01 readiness probe factory tests PASSED");
