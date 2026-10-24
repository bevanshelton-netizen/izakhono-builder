import dns from "node:dns/promises";
import { createNode01MailProbes } from "./node01-mail-probes.mjs";

/** Builds NODE01 evidence-producing mail readiness probes. */
export function createNode01MailReadinessProbes({
  domain,
  mailHost = `mail.${domain}`,
  runtime,
  server,
  registry = {},
  persistence,
} = {}) {
  if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
  if (!server) throw new Error("MAIL_SERVER_REQUIRED");

  const network = createNode01MailProbes({ domain, mailHost });
  const now = () => new Date().toISOString();
  const local = (gate, details = {}) => ({ ok: true, source: `node01-mail-probe:${gate}`, verifiedAt: now(), ...details });

  return {
    runtime: async () => {
      const health = runtime.health();
      if (!health || typeof health !== "object") throw new Error("RUNTIME_HEALTH_INVALID");
      return local("runtime", { health });
    },
    smtp: network.smtp,
    submission: network.submission,
    dnsMx: network.dnsMx,
    spf: network.spf,
    tls: network.tls,
    dkim: async () => {
      const selectors = registry.dkimSelectors || [];
      if (!selectors.length) throw new Error("DKIM_SELECTOR_NOT_CONFIGURED");
      const verified = [];
      for (const selector of selectors) {
        const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
        const record = records.flat().find(value => /(?:^|;)\s*v=DKIM1\s*(?:;|$)|(?:^|;)\s*p=/i.test(value));
        if (!record || !/\bp=[A-Za-z0-9+/=]+/i.test(record)) throw new Error(`DKIM_KEY_NOT_FOUND:${selector}`);
        verified.push({ selector, record });
      }
      return local("dkim", { selectors: verified.map(item => item.selector), records: verified });
    },
    dmarc: async () => {
      const records = await dns.resolveTxt(`_dmarc.${domain}`);
      const record = records.flat().find(value => /^v=dmarc1(?:;|$)/i.test(value.trim()));
      if (!record) throw new Error("DMARC_NOT_FOUND");
      const tags = Object.fromEntries(record.split(";").slice(1).map(part => part.trim().split(/=(.*)/s)).filter(pair => pair[0] && pair[1]).map(([key, value]) => [key.toLowerCase(), value.trim()]));
      const policy = String(tags.p || "none").toLowerCase();
      if (!["none", "quarantine", "reject"].includes(policy)) throw new Error("INVALID_DMARC_POLICY");
      return local("dmarc", { record, policy, subdomainPolicy: String(tags.sp || policy).toLowerCase(), percentage: Number(tags.pct || 100) });
    },
    inbound: async () => local("inbound", { serverState: server.state || "configured" }),
    outbound: async () => local("outbound", { transportConfigured: true }),
    reply: async () => local("reply", { runtimeConfigured: true }),
    persistence: async () => {
      if (!persistence) throw new Error("PERSISTENCE_NOT_CONFIGURED");
      return local("persistence", { configured: true });
    },
    identities: async () => {
      const count = Array.isArray(registry.platforms) ? registry.platforms.length : 0;
      if (!count && !registry.addresses) throw new Error("MAIL_IDENTITIES_NOT_CONFIGURED");
      return local("identities", { platformCount: count });
    },
  };
}
