import assert from "node:assert/strict";
import { createNode01MailReadinessProbes } from "./node01-mail-readiness-factory.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { state: "running" };
const persistence = { configured: true };
const dnsResolver = {
  resolveTxt: async (name) => {
    if (name === 'google._domainkey.gmail.com') return [['v=DKIM1; k=rsa; p=QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=']];
    if (name === 'gmail.com') return [['v=spf1 include:_spf.google.com ~all']];
    if (name === '_dmarc.gmail.com') return [['v=DMARC1; p=none; pct=100']];
    throw new Error(`UNEXPECTED_DNS_QUERY:${name}`);
  },
  resolveMx: async () => [{ priority: 10, exchange: 'mx.gmail.test' }],
};

const probes = createNode01MailReadinessProbes({
  domain: "gmail.com",
  mailHost: "smtp.gmail.com",
  runtime,
  server,
  persistence,
  registry: { dkimSelectors: ["google"] },
  dnsResolver,
});

assert.equal((await probes.runtime()).ok, true);
assert.equal((await probes.dkim()).ok, true);
assert.equal((await probes.persistence()).ok, true);
await assert.rejects(() => probes.identities(), /MAIL_IDENTITIES_NOT_CONFIGURED/);

const spf = await probes.spf();
assert.equal(spf.ok, true);
assert.equal(spf.source, "node01-mail-probe:spf");

console.log("NODE01 readiness probe factory tests PASSED");
