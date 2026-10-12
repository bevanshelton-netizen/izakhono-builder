/**
 * IZAKHONO MAIL — NODE01 production readiness probe.
 *
 * This probe is deliberately evidence-driven: DNS/TLS/network checks are
 * reported as facts, while external send/receive/reply are never inferred
 * from code health. It exits non-zero only for an explicitly requested
 * strict production gate.
 */
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

const timeoutMs = 8000;

function timeoutPromise(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms));
}

async function withTimeout(promise, label) {
  return Promise.race([promise, timeoutPromise(timeoutMs, label)]);
}

async function resolve(host, rrtype) {
  try {
    const records = await withTimeout(dns.resolve(host, rrtype), `DNS_${rrtype}`);
    return { ok: true, records };
  } catch (error) {
    return { ok: false, error: String(error?.code || error?.message || error) };
  }
}

async function tcp(host, port) {
  return withTimeout(new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.once("connect", () => done({ ok: true }));
    socket.once("error", (error) => done({ ok: false, error: String(error?.code || error?.message || error) }));
  }), `TCP_${port}`);
}

async function tlsProbe(host, port = 587) {
  return withTimeout(new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.once("secureConnect", () => done({ ok: true, protocol: socket.getProtocol(), authorized: socket.authorized }));
    socket.once("error", (error) => done({ ok: false, error: String(error?.code || error?.message || error) }));
  }), "TLS");
}

export async function probeNode01Mail({
  host = process.env.IZAKHONO_MAIL_HOST || "mail.izakhono.co.za",
  domain = process.env.IZAKHONO_MAIL_DOMAIN || "izakhonoafrica.co.za",
  smtpPort = Number(process.env.IZAKHONO_SMTP_PORT || 25),
  submissionPort = Number(process.env.IZAKHONO_SUBMISSION_PORT || 587),
  strict = false,
} = {}) {
  const [a, aaaa, mx, txt] = await Promise.all([
    resolve(host, "A"),
    resolve(host, "AAAA"),
    resolve(domain, "MX"),
    resolve(domain, "TXT"),
  ]);

  const smtp = a.ok || aaaa.ok ? await tcp(host, smtpPort) : { ok: false, error: "HOST_UNRESOLVED" };
  const submission = a.ok || aaaa.ok ? await tcp(host, submissionPort) : { ok: false, error: "HOST_UNRESOLVED" };
  const tls = a.ok || aaaa.ok ? await tlsProbe(host, submissionPort) : { ok: false, error: "HOST_UNRESOLVED" };

  const txtRecords = txt.ok ? txt.records.flat() : [];
  const spf = txtRecords.some(value => /^v=spf1\b/i.test(value));
  const dmarc = await resolve(`_dmarc.${domain}`, "TXT");
  const dkimSelector = process.env.IZAKHONO_DKIM_SELECTOR;
  const dkim = dkimSelector
    ? await resolve(`${dkimSelector}._domainkey.${domain}`, "TXT")
    : { ok: false, error: "DKIM_SELECTOR_NOT_CONFIGURED" };

  const result = {
    host,
    domain,
    dns: { a, aaaa, mx },
    authentication: { spf, dkim: dkim.ok, dmarc: dmarc.ok },
    network: { smtp, submission, tls },
    externalDelivery: { send: false, receive: false, reply: false, evidenceRequired: true },
    production: false,
  };

  result.production = Boolean(
    (a.ok || aaaa.ok) && mx.ok && spf && dkim.ok && dmarc.ok && smtp.ok && submission.ok && tls.ok &&
    result.externalDelivery.send && result.externalDelivery.receive && result.externalDelivery.reply
  );

  if (strict && !result.production) throw new Error("NODE01_MAIL_NOT_PRODUCTION_VERIFIED");
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes("--strict");
  const result = await probeNode01Mail({ strict });
  console.log(JSON.stringify(result, null, 2));
}
