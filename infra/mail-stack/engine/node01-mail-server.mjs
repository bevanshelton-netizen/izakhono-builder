/**
 * IZAKHONO MAIL — NODE01 owned mail-server engine.
 *
 * NODE01 is the runtime substrate. This module owns the SMTP boundary and
 * delegates message classification/storage/delivery to the existing engines.
 * No commercial mail provider is required by this layer.
 */
import net from "node:net";
import tls from "node:tls";

const CRLF = "\r\n";

function line(socket, text) { socket.write(`${text}${CRLF}`); }

function parseCommand(raw) {
  const i = raw.indexOf(" ");
  return i < 0 ? { command: raw.trim().toUpperCase(), arg: "" } : { command: raw.slice(0, i).trim().toUpperCase(), arg: raw.slice(i + 1).trim() };
}

export class Node01MailServer {
  constructor({ runtime, host = "0.0.0.0", port = 25, submissionPort = 587, maxMessageBytes = 25 * 1024 * 1024, banner = "IZAKHONO MAIL / NODE01" } = {}) {
    if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
    this.runtime = runtime;
    this.host = host;
    this.port = port;
    this.submissionPort = submissionPort;
    this.maxMessageBytes = maxMessageBytes;
    this.banner = banner;
    this.servers = [];
  }

  async start({ tlsOptions = null } = {}) {
    const smtp = this.#createServer({ tlsOptions, submission: false });
    const submission = this.#createServer({ tlsOptions, submission: true });
    await Promise.all([
      this.#listen(smtp, this.port),
      this.#listen(submission, this.submissionPort),
    ]);
    this.servers = [smtp, submission];
    return { host: this.host, smtp: this.port, submission: this.submissionPort };
  }

  async stop() {
    await Promise.all(this.servers.map(server => new Promise(resolve => server.close(resolve))));
    this.servers = [];
  }

  #listen(server, port) {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, this.host, () => { server.removeListener("error", reject); resolve(); });
    });
  }

  #createServer({ tlsOptions, submission }) {
    const handler = socket => this.#session(socket, { submission });
    if (submission && tlsOptions) return tls.createServer(tlsOptions, handler);
    return net.createServer(handler);
  }

  async #session(socket, { submission }) {
    socket.setEncoding("utf8");
    let state = "greeting";
    let sender = null;
    let recipients = [];
    let data = "";
    let bytes = 0;
    let authenticated = !submission;

    line(socket, `220 ${this.banner} ESMTP ready`);
    const reset = () => { sender = null; recipients = []; data = ""; bytes = 0; state = "command"; };
    reset();

    const processLine = async raw => {
      if (state === "data") {
        if (raw === ".") {
          state = "command";
          try {
            const message = { from: sender, to: recipients, raw: data };
            const result = this.runtime.ingest(message);
            if (result.disposition === "deliver") line(socket, "250 2.0.0 accepted for delivery");
            else if (result.disposition === "quarantine") line(socket, "250 2.0.0 accepted for security review");
            else line(socket, "550 5.7.1 message rejected");
          } catch (error) { line(socket, `451 4.3.0 temporary processing failure`); }
          reset();
          return;
        }
        const addition = `${raw}${CRLF}`;
        bytes += Buffer.byteLength(addition);
        if (bytes > this.maxMessageBytes) { line(socket, "552 5.3.4 message too large"); socket.destroy(); return; }
        data += addition;
        return;
      }

      const { command, arg } = parseCommand(raw);
      if (command === "EHLO" || command === "HELO") {
        line(socket, `250-${this.banner}`);
        line(socket, "250-SIZE 26214400");
        line(socket, "250-8BITMIME");
        if (submission) line(socket, "250 AUTH PLAIN LOGIN"); else line(socket, "250 HELP");
      } else if (command === "AUTH" && submission) {
        // Authentication is deliberately injected by NODE01's auth adapter.
        // The bare server never accepts credentials without a configured adapter.
        line(socket, "535 5.7.8 authentication unavailable");
      } else if (command === "MAIL") {
        if (submission && !authenticated) { line(socket, "530 5.7.0 authentication required"); return; }
        const match = arg.match(/^FROM:\s*<([^>]+)>/i);
        if (!match) { line(socket, "501 5.5.4 invalid sender"); return; }
        sender = match[1].trim().toLowerCase(); recipients = []; line(socket, "250 2.1.0 sender ok");
      } else if (command === "RCPT") {
        const match = arg.match(/^TO:\s*<([^>]+)>/i);
        if (!match || !sender) { line(socket, "503 5.5.1 bad sequence"); return; }
        recipients.push(match[1].trim().toLowerCase()); line(socket, "250 2.1.5 recipient ok");
      } else if (command === "DATA") {
        if (!sender || !recipients.length) { line(socket, "503 5.5.1 need MAIL FROM and RCPT TO"); return; }
        state = "data"; line(socket, "354 End data with <CR><LF>.<CR><LF>");
      } else if (command === "RSET") { reset(); line(socket, "250 2.0.0 reset"); }
      else if (command === "NOOP") line(socket, "250 2.0.0 ok");
      else if (command === "QUIT") { line(socket, "221 2.0.0 closing connection"); socket.end(); }
      else line(socket, "502 5.5.1 command not implemented");
    };

    let buffer = "";
    socket.on("data", async chunk => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        await processLine(raw);
        if (socket.destroyed) return;
      }
    });
  }
}
