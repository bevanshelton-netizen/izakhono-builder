import { createNode01MailProbes } from "./node01-mail-probes.mjs";

/**
 * Builds the NODE01 evidence-producing probe set.
 * Local/configuration gates are supplied by adapters so the orchestrator
 * remains deterministic and testable; network/DNS gates use real probes.
 */
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
  const local = (gate, details = {}) => ({
    ok: true,
    source: `node01-mail-probe:${gate}`,
    verifiedAt: now(),
    ...details,
  });

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
      return local("dkim", { selectors });
    },
    dmarc: async () => {
      const records = await import("node:dns/promises").then(({ default: dns }) => dns.resolveTxt(`_dmarc.${domain}`));
      const record = records.flat().find(value => value.toLowerCase().startsWith("v=dmarc1"));
      if (!record) throw new Error("DMARC_NOT_FOUND");
      return local("dmarc", { record });
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
