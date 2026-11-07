import assert from "node:assert/strict";
import { createNode01MailReadinessProbes } from "./node01-mail-readiness-factory.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { state: "running" };
const persistence = { configured: true };
const dnsResolver = {\n  resolveTxt: async (name) => {\n    if (name === 'google._domainkey.gmail.com') return [['v=DKIM1; k=rsa; p=QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=']];\n    if (name === 'gmail.com') return [['v=spf1 include:_spf.google.com ~all']];\n    if (name === '_dmarc.gmail.com') return [['v=DMARC1; p=none; pct=100']];\n    throw new Error(`UNEXPECTED_DNS_QUERY:${name}`);\n  },\n  resolveMx: async () => [{ priority: 10, exchange: 'mx.gmail.test' }],\n};\n\nconst probes = createNode01MailReadinessProbes({
  domain: "gmail.com",
  mailHost: "smtp.gmail.com",
  runtime,
  server,
  persistence,
  registry: { dkimSelectors: ["google"] },\n  dnsResolver,
});

assert.equal((await probes.runtime()).ok, true);
assert.equal((await probes.dkim()).ok, true);
assert.equal((await probes.persistence()).ok, true);
assert.equal((await probes.identities()).ok, false);

const spf = await probes.spf();
assert.equal(spf.ok, true);
assert.equal(spf.source, "node01-mail-probe:spf");

console.log("NODE01 readiness probe factory tests PASSED");
