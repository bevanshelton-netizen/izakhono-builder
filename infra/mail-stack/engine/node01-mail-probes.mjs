/**
 * IZAKHONO MAIL — real readiness probes.
 *
 * These probes verify reachable infrastructure; they never manufacture LIVE
 * evidence. DNS and network probes are intentionally dependency-light so the
 * same code can run on NODE01 or an owned CI worker.
 */
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

function evidence(gate, details = {}) {
  return {
    ok: true,
    source: `node01-mail-probe:${gate}`,
    verifiedAt: new Date().toISOString(),
    ...details,
  };
}

function fail(gate, error) {
  return {
    ok: false,
    source: `node01-mail-probe:${gate}`,
    verifiedAt: new Date().toISOString(),
    reason: String(error?.code || error?.message || error),
  };
}

export async function probeDnsMx(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (!records.length) throw new Error("MX_NOT_FOUND");
    return evidence("dnsMx", { records: records.sort((a, b) => a.priority - b.priority) });
  } catch (error) { return fail("dnsMx", error); }
}

export async function probeTcp(host, port, timeoutMs = 5000) {
  return await new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs, () => finish(fail(`${port}`, new Error("TIMEOUT"))));
    socket.once("connect", () => finish(evidence(`${port}`, { host, port })));
    socket.once("error", error => finish(fail(`${port}`, error)));
  });
}

export async function probeTls(host, port = 465, timeoutMs = 5000) {
  return await new Promise(resolve => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    const finish = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs, () => finish(fail("tls", new Error("TIMEOUT"))));
    socket.once("secureConnect", () => finish(evidence("tls", {
      host, port,
      protocol: socket.getProtocol(),
      authorized: socket.authorized,
      authorizationError: socket.authorizationError || null,
    })));
    socket.once("error", error => finish(fail("tls", error)));
  });
}

export function createNode01MailProbes({ domain, mailHost = `mail.${domain}`, smtpPort = 25, submissionPort = 587, tlsPort = 465 } = {}) {
  if (!domain) throw new Error("MAIL_DOMAIN_REQUIRED");
  return {
    dnsMx: () => probeDnsMx(domain),
    smtp: () => probeTcp(mailHost, smtpPort),
    submission: () => probeTcp(mailHost, submissionPort),
    tls: () => probeTls(mailHost, tlsPort),
    spf: async () => {
      try {
        const records = await dns.resolveTxt(domain);
        const spf = records.flat().find(record => record.toLowerCase().startsWith("v=spf1"));
        if (!spf) throw new Error("SPF_NOT_FOUND");
        return evidence("spf", { record: spf });
      } catch (error) { return fail("spf", error); }
    },
  };
}
