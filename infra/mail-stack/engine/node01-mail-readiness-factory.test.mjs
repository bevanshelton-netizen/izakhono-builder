import assert from "node:assert/strict";
import { createNode01MailReadinessProbes } from "./node01-mail-readiness-factory.mjs";

const runtime = { health: () => ({ queue: { size: 0 }, transports: [] }) };
const server = { state: "running" };
const persistence = { configured: true };
const dnsResolver = {
  async resolveMx(domain) {
    assert.equal(domain, "izakhono.example");
    return [{ priority: 10, exchange: "mail.izakhono.example" }];
  },
  async resolveTxt(name) {
    const records = {
      "izakhono.example": [["v=spf1 include:_spf.izakhono.example -all"]],
      "google._domainkey.izakhono.example": [["v=DKIM1; k=rsa; p=QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="]],
      "_dmarc.izakhono.example": [["v=DMARC1; p=reject; sp=reject; pct=100"]],
    };
    if (!records[name]) throw Object.assign(new Error("record not found"), { code: "ENOTFOUND" });
    return records[name];
  },
};
const probes = createNode01MailReadinessProbes({
  domain: "izakhono.example",
  mailHost: "mail.izakhono.example",
  runtime,
  server,
  persistence,
  dnsResolver,
  registry: { dkimSelectors: ["google"] },
});

assert.equal((await probes.runtime()).ok, true);
assert.equal((await probes.dkim()).ok, true);
assert.equal((await probes.dmarc()).policy, "reject");
assert.equal((await probes.dnsMx()).ok, true);
assert.equal((await probes.persistence()).ok, true);
assert.equal((await probes.identities()).ok, false);
const spf = await probes.spf();
assert.equal(spf.ok, true);
assert.equal(spf.source, "node01-mail-probe:spf");

console.log("NODE01 readiness probe factory tests PASSED (deterministic DNS fixture)");
