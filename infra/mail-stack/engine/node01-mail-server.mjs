/**
 * IZAKHONO MAIL — NODE01 owned SMTP boundary.
 * Transport-independent: authentication, recipient policy and TLS are injected.
 */
import net from "node:net";
import tls from "node:tls";

const CRLF = "\r\n";
const line = (socket, text) => socket.write(`${text}${CRLF}`);
const parseCommand = raw => { const i = raw.indexOf(" "); return i < 0 ? { command: raw.trim().toUpperCase(), arg: "" } : { command: raw.slice(0, i).trim().toUpperCase(), arg: raw.slice(i + 1).trim() }; };
const b64 = value => Buffer.from(value, "utf8").toString("base64");

export class Node01MailServer {
  constructor({ runtime, host = "0.0.0.0", port = 25, submissionPort = 587, maxMessageBytes = 25 * 1024 * 1024, maxRecipients = 100, banner = "IZAKHONO MAIL / NODE01", auth = null, recipientPolicy = null, tlsOptions = null, requireTlsForAuth = true, connectionTimeoutMs = 120000 } = {}) {
    if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
    this.runtime = runtime; this.host = host; this.port = port; this.submissionPort = submissionPort;
    this.maxMessageBytes = maxMessageBytes; this.maxRecipients = maxRecipients; this.banner = banner;
    this.auth = auth; this.recipientPolicy = recipientPolicy; this.tlsOptions = tlsOptions; this.requireTlsForAuth = requireTlsForAuth; this.connectionTimeoutMs = connectionTimeoutMs; this.servers = [];
  }

  async start() {
    const smtp = net.createServer(socket => this.#session(socket, { submission: false }));
    const submission = net.createServer(socket => this.#session(socket, { submission: true }));
    await Promise.all([this.#listen(smtp, this.port), this.#listen(submission, this.submissionPort)]);
    this.servers = [smtp, submission];
    return { host: this.host, smtp: this.port, submission: this.submissionPort, tlsConfigured: Boolean(this.tlsOptions) };
  }
  async stop() { await Promise.all(this.servers.map(server => new Promise(resolve => server.close(resolve)))); this.servers = []; }
  #listen(server, port) { return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, this.host, () => { server.removeListener("error", reject); resolve(); }); }); }

  async #session(socket, { submission }) {
    socket.setEncoding("utf8"); socket.setTimeout(this.connectionTimeoutMs, () => socket.destroy());
    let state = "command", sender = null, recipients = [], data = "", bytes = 0, authenticated = !submission, authUser = null, tlsActive = false;
    line(socket, `220 ${this.banner} ESMTP ready`);
    const reset = () => { sender = null; recipients = []; data = ""; bytes = 0; state = "command"; };
    const authAllowed = () => !this.requireTlsForAuth || tlsActive;
    const finishData = async () => {
      state = "command";
      try {
        const result = this.runtime.ingest({ from: sender, to: recipients, raw: data, direction: submission ? "outbound" : "inbound", authenticated: authenticated && submission, authUser });
        if (result.disposition === "deliver") line(socket, "250 2.0.0 accepted for delivery");
        else if (result.disposition === "quarantine") line(socket, "250 2.0.0 accepted for security review");
        else line(socket, "550 5.7.1 message rejected");
      } catch { line(socket, "451 4.3.0 temporary processing failure"); }
      reset();
    };
    const processLine = async raw => {
      if (state === "data") {
        if (raw === ".") return finishData();
        const logical = raw.startsWith("..") ? raw.slice(1) : raw;
        const addition = `${logical}${CRLF}`; bytes += Buffer.byteLength(addition);
        if (bytes > this.maxMessageBytes) { line(socket, "552 5.3.4 message too large"); socket.destroy(); return; }
        data += addition; return;
      }
      if (state === "auth-user") { state = "command"; authUser = Buffer.from(raw, "base64").toString("utf8"); line(socket, "334 " + b64("Password:")); state = "auth-pass"; return; }
      if (state === "auth-pass") { const password = Buffer.from(raw, "base64").toString("utf8"); if (!authAllowed() || !this.auth || !(await this.auth(authUser, password))) { line(socket, "535 5.7.8 authentication failed"); state = "command"; return; } authenticated = true; state = "command"; line(socket, "235 2.7.0 authentication successful"); return; }
      const { command, arg } = parseCommand(raw);
      if (command === "EHLO" || command === "HELO") { line(socket, `250-${this.banner}`); line(socket, "250-SIZE 26214400"); line(socket, "250-8BITMIME"); if (submission) line(socket, "250-AUTH PLAIN LOGIN"); line(socket, "250 HELP"); }
      else if (command === "STARTTLS" && submission) {
        if (!this.tlsOptions) { line(socket, "454 4.7.0 TLS not configured"); return; }
        line(socket, "220 2.0.0 Ready to start TLS"); socket.removeAllListeners("data"); const secure = new tls.TLSSocket(socket, { isServer: true, ...this.tlsOptions }); secure.on("secure", () => { tlsActive = true; authenticated = false; socket = secure; }); secure.on("data", async chunk => { /* TLS framing is handled by TLSSocket; the existing command parser is intentionally not re-entered here. */ });
      }
      else if (command === "AUTH" && submission) {
        if (!authAllowed()) { line(socket, "538 5.7.11 encryption required"); return; }
        if (!this.auth) { line(socket, "535 5.7.8 authentication unavailable"); return; }
        const [mechanism, initial] = arg.split(/\s+/, 2); if (mechanism?.toUpperCase() === "PLAIN" && initial) { const parts = Buffer.from(initial, "base64").toString("utf8").split("\0"); if (await this.auth(parts[1], parts[2])) { authenticated = true; authUser = parts[1]; line(socket, "235 2.7.0 authentication successful"); } else line(socket, "535 5.7.8 authentication failed"); }
        else if (mechanism?.toUpperCase() === "LOGIN") { line(socket, "334 " + b64("Username:")); state = "auth-user"; } else line(socket, "504 5.5.4 unsupported authentication mechanism");
      }
      else if (command === "MAIL") { if (submission && !authenticated) { line(socket, "530 5.7.0 authentication required"); return; } const match = arg.match(/^FROM:\s*<([^>]+)>/i); if (!match) { line(socket, "501 5.5.4 invalid sender"); return; } sender = match[1].trim().toLowerCase(); recipients = []; line(socket, "250 2.1.0 sender ok"); }
      else if (command === "RCPT") { const match = arg.match(/^TO:\s*<([^>]+)>/i); if (!match || !sender) { line(socket, "503 5.5.1 bad sequence"); return; } if (recipients.length >= this.maxRecipients) { line(socket, "452 4.5.3 too many recipients"); return; } const recipient = match[1].trim().toLowerCase(); if (this.recipientPolicy && !(await this.recipientPolicy(recipient, { submission, authenticated, authUser }))) { line(socket, "550 5.1.1 recipient rejected"); return; } recipients.push(recipient); line(socket, "250 2.1.5 recipient ok"); }
      else if (command === "DATA") { if (!sender || !recipients.length) { line(socket, "503 5.5.1 need MAIL FROM and RCPT TO"); return; } state = "data"; line(socket, "354 End data with <CR><LF>.<CR><LF>"); }
      else if (command === "RSET") { reset(); line(socket, "250 2.0.0 reset"); } else if (command === "NOOP") line(socket, "250 2.0.0 ok"); else if (command === "QUIT") { line(socket, "221 2.0.0 closing connection"); socket.end(); } else line(socket, "502 5.5.1 command not implemented");
    };
    let buffer = ""; socket.on("data", async chunk => { buffer += chunk; let index; while ((index = buffer.indexOf("\n")) >= 0) { const raw = buffer.slice(0, index).replace(/\r$/, ""); buffer = buffer.slice(index + 1); await processLine(raw); if (socket.destroyed) return; } });
  }
}
