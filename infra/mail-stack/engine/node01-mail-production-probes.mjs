/**
 * IZAKHONO MAIL — real external production evidence probes.
 *
 * These probes are intentionally environment-driven. They never manufacture
 * evidence: a production gate is positive only when a real network operation
 * succeeds and the result carries its source and verification timestamp.
 *
 * End-to-end mailbox gates (inboundPersistence, outboundAccepted,
 * replyReceived, identityRouting and securityAuthentication) are supplied by
 * the deployment acceptance adapter because the control plane must not embed
 * credentials or assume a particular external mailbox provider.
 */

import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

function evidence(gate, details = {}) {
  return {
    ok: true,
    source: `node01-production-probe:${gate}`,
    verifiedAt: new Date().toISOString(),
    ...details,
  };
}

function fail(gate, error) {
  const message = String(error?.message || error);
  return {
    ok: false,
    source: `node01-production-probe:${gate}`,
    verifiedAt: new Date().toISOString(),
    reason: message,
  };
}

function tcpProbe(host, port, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function tlsProbe(host, port = 465, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish({ ok: false, reason: "TLS_TIMEOUT" }));
    socket.once("secureConnect", () => finish({
      ok: socket.authorized === true,
      authorized: socket.authorized,
      authorizationError: socket.authorizationError || null,
      protocol: socket.getProtocol(),
    }));
    socket.once("error", (error) => finish({ ok: false, reason: String(error?.message || error) }));
  });
}

export function createRealNode01MailProductionProbes({
  domain,
  mailHost = `mail.${domain}`,
  smtpPort = 25,
  submissionPort = 587,
  tlsPort = 465,
  externalAcceptance = {},
} = {}) {
  if (!domain) throw new Error("MAIL_DOMAIN_REQUIRED");

  const delegated = [
    "authenticatedSubmission",
    "inboundPersistence",
    "outboundAccepted",
    "replyReceived",
    "identityRouting",
    "securityAuthentication",
  ];

  const probes = {
    publicMx: async () => {
      try {
        const records = await dns.resolveMx(domain);
        if (!records.length) throw new Error("PUBLIC_MX_NOT_FOUND");
        return evidence("publicMx", { records: records.sort((a, b) => a.priority - b.priority) });
      } catch (error) {
        return fail("publicMx", error);
      }
    },
    publicSmtp: async () => {
      try {
        if (!(await tcpProbe(mailHost, smtpPort))) throw new Error(`SMTP_UNREACHABLE:${mailHost}:${smtpPort}`);
        return evidence("publicSmtp", { host: mailHost, port: smtpPort });
      } catch (error) {
        return fail("publicSmtp", error);
      }
    },
    publicSubmission: async () => {
      try {
        if (!(await tcpProbe(mailHost, submissionPort))) throw new Error(`SUBMISSION_UNREACHABLE:${mailHost}:${submissionPort}`);
        return evidence("publicSubmission", { host: mailHost, port: submissionPort });
      } catch (error) {
        return fail("publicSubmission", error);
      }
    },
    publicTls: async () => {
      try {
        const result = await tlsProbe(mailHost, tlsPort);
        if (!result.ok) throw new Error(result.reason || "TLS_UNAUTHORIZED");
        return evidence("publicTls", {
          host: mailHost,
          port: tlsPort,
          authorized: result.authorized,
          protocol: result.protocol,
        });
      } catch (error) {
        return fail("publicTls", error);
      }
    },
  };

  for (const gate of delegated) {
    probes[gate] = async () => {
      const adapter = externalAcceptance[gate];
      if (typeof adapter !== "function") {
        return {
          ok: false,
          source: `node01-production-probe:${gate}`,
          verifiedAt: new Date().toISOString(),
          reason: "EXTERNAL_ACCEPTANCE_ADAPTER_REQUIRED",
        };
      }
      try {
        const result = await adapter();
        if (!result?.ok) return fail(gate, result?.reason || "EXTERNAL_ACCEPTANCE_FAILED");
        return evidence(gate, { ...result, ok: true });
      } catch (error) {
        return fail(gate, error);
      }
    };
  }

  return probes;
}
