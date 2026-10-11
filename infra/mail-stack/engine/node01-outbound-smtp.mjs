/** IZAKHONO MAIL — NODE01 outbound SMTP delivery engine. */
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

const CRLF = "\r\n";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function mxHosts(domain) {
  const records = await dns.resolveMx(domain);
  return records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk.toString();
      if (/^\d{3} /.test(buffer.split(/\r?\n/).filter(Boolean).pop() || "")) {
        socket.off("data", onData); resolve(buffer.trim());
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

function command(socket, text) { socket.write(`${text}${CRLF}`); return readResponse(socket); }

function envelopeFrom(message) { return message.from || "postmaster@localhost"; }

export class Node01OutboundSMTP {
  constructor({ timeoutMs = 15000, attempts = 5, backoffMs = 1000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.attempts = attempts;
    this.backoffMs = backoffMs;
    this.name = "node01-outbound-smtp";
    this.mode = "owned";
    this.priority = 1;
    this.enabled = true;
  }

  supports(envelope) { return Array.isArray(envelope?.to) && envelope.to.length > 0; }

  async send(envelope) {
    const results = [];
    for (const recipient of envelope.to) results.push(await this.#deliverOne(envelope, recipient));
    return { delivered: results.filter(r => r.ok).length, results };
  }

  async #deliverOne(message, recipient) {
    const domain = recipient.split("@").pop()?.toLowerCase();
    if (!domain) throw new Error("INVALID_RECIPIENT_DOMAIN");
    let lastError;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        const hosts = await mxHosts(domain);
        for (const host of hosts) {
          try { await this.#smtp(host, envelopeFrom(message), recipient, message.raw); return { recipient, ok: true, host, attempt }; }
          catch (error) { lastError = error; }
        }
      } catch (error) { lastError = error; }
      if (attempt < this.attempts) await sleep(this.backoffMs * 2 ** (attempt - 1));
    }
    throw new Error(`DELIVERY_FAILED:${recipient}:${String(lastError?.message || lastError)}`);
  }

  async #smtp(host, from, to, raw) {
    const socket = await new Promise((resolve, reject) => {
      const s = net.createConnection({ host, port: 25 });
      const timer = setTimeout(() => { s.destroy(); reject(new Error("SMTP_TIMEOUT")); }, this.timeoutMs);
      s.once("connect", () => { clearTimeout(timer); resolve(s); });
      s.once("error", e => { clearTimeout(timer); reject(e); });
    });
    try {
      const greeting = await readResponse(socket);
      if (!/^220\b/.test(greeting)) throw new Error(`SMTP_GREETING:${greeting}`);
      const helo = await command(socket, "EHLO mail.izakhono.local");
      if (!/^250[ -]/m.test(helo)) throw new Error(`SMTP_EHLO:${helo}`);
      const sender = await command(socket, `MAIL FROM:<${from}>`);
      if (!/^250\b/m.test(sender)) throw new Error(`SMTP_MAIL_FROM:${sender}`);
      const rcpt = await command(socket, `RCPT TO:<${to}>`);
      if (!/^250\b|^251\b/m.test(rcpt)) throw new Error(`SMTP_RCPT:${rcpt}`);
      const data = await command(socket, "DATA");
      if (!/^354\b/m.test(data)) throw new Error(`SMTP_DATA:${data}`);
      socket.write(`${String(raw || "").replace(/\r?\n/g, CRLF)}${CRLF}.${CRLF}`);
      const accepted = await readResponse(socket);
      if (!/^250\b/m.test(accepted)) throw new Error(`SMTP_ACCEPT:${accepted}`);
      await command(socket, "QUIT");
    } finally { socket.destroy(); }
  }
}

export async function createNode01OutboundSMTP(options) { return new Node01OutboundSMTP(options); }
