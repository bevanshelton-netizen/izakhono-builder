/**
 * IZAKHONO MAIL — NODE01 owned SMTP boundary.
 * Transport-independent: authentication, recipient policy and TLS are injected.
 */
import net from "node:net";
import tls from "node:tls";

const CRLF = "\r\n";
const line = (socket, text) => socket.write(`${text}${CRLF}`);
const parseCommand = raw => {
  const i = raw.indexOf(" ");
  return i < 0
    ? { command: raw.trim().toUpperCase(), arg: "" }
    : { command: raw.slice(0, i).trim().toUpperCase(), arg: raw.slice(i + 1).trim() };
};
const b64 = value => Buffer.from(value, "utf8").toString("base64");

export class Node01MailServer {
  constructor({ runtime, host = "0.0.0.0", port = 25, submissionPort = 587, maxMessageBytes = 25 * 1024 * 1024, maxRecipients = 100, banner = "IZAKHONO MAIL / NODE01", auth = null, recipientPolicy = null, tlsOptions = null, requireTlsForAuth = true, connectionTimeoutMs = 120000 } = {}) {
    if (!runtime) throw new Error("MAIL_RUNTIME_REQUIRED");
    this.runtime = runtime;
    this.host = host;
    this.port = port;
    this.submissionPort = submissionPort;
    this.maxMessageBytes = maxMessageBytes;
    this.maxRecipients = maxRecipients;
    this.banner = banner;
    this.auth = auth;
    this.recipientPolicy = recipientPolicy;
    this.tlsOptions = tlsOptions;
    this.requireTlsForAuth = requireTlsForAuth;
    this.connectionTimeoutMs = connectionTimeoutMs;
    this.servers = [];
  }

  async start() {
    const smtp = net.createServer(socket => this.#session(socket, { submission: false }));
    const submission = net.createServer(socket => this.#session(socket, { submission: true }));
    await Promise.all([this.#listen(smtp, this.port), this.#listen(submission, this.submissionPort)]);
    this.servers = [smtp, submission];
    return { host: this.host, smtp: this.port, submission: this.submissionPort, tlsConfigured: Boolean(this.tlsOptions) };
  }

  async stop() {
    await Promise.all(this.servers.map(server => new Promise(resolve => server.close(resolve))));
    this.servers = [];
  }

  #listen(server, port) {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, this.host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  }

  async #session(initialSocket, { submission }) {
    let socket = initialSocket;
    socket.setEncoding("utf8");
    socket.setTimeout(this.connectionTimeoutMs, () => socket.destroy());

    let state = "command";
    let sender = null;
    let recipients = [];
    let data = "";
    let bytes = 0;
    let authenticated = !submission;
    let authUser = null;
    let tlsActive = false;
    let buffer = "";
    let parserAttached = false;

    const reply = text => line(socket, text);
    const reset = () => {
      sender = null;
      recipients = [];
      data = "";
      bytes = 0;
      state = "command";
    };
    const authAllowed = () => !this.requireTlsForAuth || tlsActive;

    reply(`220 ${this.banner} ESMTP ready`);

    const finishData = async () => {
      state = "command";
      try {
        const result = this.runtime.ingest({
          from: sender,
          to: recipients,
          raw: data,
          direction: submission ? "outbound" : "inbound",
          authenticated: authenticated && submission,
          authUser
        });
        if (result.disposition === "deliver") reply("250 2.0.0 accepted for delivery");
        else if (result.disposition === "quarantine") reply("250 2.0.0 accepted for security review");
        else reply("550 5.7.1 message rejected");
      } catch {
        reply("451 4.3.0 temporary processing failure");
      }
      reset();
    };

    const processLine = async raw => {
      if (state === "data") {
        if (raw === ".") return finishData();
        const logical = raw.startsWith("..") ? raw.slice(1) : raw;
        const addition = `${logical}${CRLF}`;
        bytes += Buffer.byteLength(addition);
        if (bytes > this.maxMessageBytes) {
          reply("552 5.3.4 message too large");
          socket.destroy();
          return;
        }
        data += addition;
        return;
      }

      if (state === "auth-user") {
        authUser = Buffer.from(raw, "base64").toString("utf8");
        reply("334 " + b64("Password:"));
        state = "auth-pass";
        return;
      }

      if (state === "auth-pass") {
        const password = Buffer.from(raw, "base64").toString("utf8");
        if (!authAllowed() || !this.auth || !(await this.auth(authUser, password))) {
          reply("535 5.7.8 authentication failed");
          state = "command";
          return;
        }
        authenticated = true;
        state = "command";
        reply("235 2.7.0 authentication successful");
        return;
      }

      const { command, arg } = parseCommand(raw);

      if (command === "EHLO" || command === "HELO") {
        reply(`250-${this.banner}`);
        reply("250-SIZE 26214400");
        reply("250-8BITMIME");
        if (!tlsActive && this.tlsOptions) reply("250-STARTTLS");
        if (submission && !tlsActive && this.auth) reply("250-AUTH PLAIN LOGIN");
        if (submission && tlsActive && this.auth) reply("250-AUTH PLAIN LOGIN");
        reply("250 HELP");
        return;
      }

      if (command === "STARTTLS") {
        if (tlsActive) {
          reply("503 5.5.1 TLS already active");
          return;
        }
        if (!this.tlsOptions) {
          reply("454 4.7.0 TLS not configured");
          return;
        }
        reply("220 2.0.0 Ready to start TLS");
        parserAttached = false;
        socket.removeAllListeners("data");
        const plainSocket = socket;
        const secure = new tls.TLSSocket(plainSocket, { isServer: true, ...this.tlsOptions });
        socket = secure;
        socket.setEncoding("utf8");
        socket.setTimeout(this.connectionTimeoutMs, () => socket.destroy());
        secure.once("secure", () => {
          tlsActive = true;
          authenticated = false;
          authUser = null;
          state = "command";
          sender = null;
          recipients = [];
          data = "";
          bytes = 0;
          buffer = "";
          attachParser();
        });
        secure.once("error", () => secure.destroy());
        return;
      }

      if (command === "AUTH" && submission) {
        if (!authAllowed()) {
          reply("538 5.7.11 encryption required");
          return;
        }
        if (!this.auth) {
          reply("535 5.7.8 authentication unavailable");
          return;
        }
        const [mechanism, initial] = arg.split(/\s+/, 2);
        if (mechanism?.toUpperCase() === "PLAIN" && initial) {
          const parts = Buffer.from(initial, "base64").toString("utf8").split("\0");
          if (await this.auth(parts[1], parts[2])) {
            authenticated = true;
            authUser = parts[1];
            reply("235 2.7.0 authentication successful");
          } else reply("535 5.7.8 authentication failed");
        } else if (mechanism?.toUpperCase() === "LOGIN") {
          reply("334 " + b64("Username:"));
          state = "auth-user";
        } else reply("504 5.5.4 unsupported authentication mechanism");
        return;
      }

      if (command === "MAIL") {
        if (submission && !authenticated) {
          reply("530 5.7.0 authentication required");
          return;
        }
        const match = arg.match(/^FROM:\s*<([^>]+)>/i);
        if (!match) {
          reply("501 5.5.4 invalid sender");
          return;
        }
        sender = match[1].trim().toLowerCase();
        recipients = [];
        reply("250 2.1.0 sender ok");
        return;
      }

      if (command === "RCPT") {
        const match = arg.match(/^TO:\s*<([^>]+)>/i);
        if (!match || !sender) {
          reply("503 5.5.1 bad sequence");
          return;
        }
        if (recipients.length >= this.maxRecipients) {
          reply("452 4.5.3 too many recipients");
          return;
        }
        const recipient = match[1].trim().toLowerCase();
        if (this.recipientPolicy && !(await this.recipientPolicy(recipient, { submission, authenticated, authUser }))) {
          reply("550 5.1.1 recipient rejected");
          return;
        }
        recipients.push(recipient);
        reply("250 2.1.5 recipient ok");
        return;
      }

      if (command === "DATA") {
        if (!sender || !recipients.length) {
          reply("503 5.5.1 need MAIL FROM and RCPT TO");
          return;
        }
        state = "data";
        reply("354 End data with <CR><LF>.<CR><LF>");
        return;
      }

      if (command === "RSET") {
        reset();
        reply("250 2.0.0 reset");
      } else if (command === "NOOP") {
        reply("250 2.0.0 ok");
      } else if (command === "QUIT") {
        reply("221 2.0.0 closing connection");
        socket.end();
      } else {
        reply("502 5.5.1 command not implemented");
      }
    };

    const attachParser = () => {
      if (parserAttached || socket.destroyed) return;
      parserAttached = true;
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
    };

    attachParser();
  }
}
