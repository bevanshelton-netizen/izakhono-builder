/** IZAKHONO MAIL — provider-neutral SMTP outbound transport. */
import net from "node:net";
import tls from "node:tls";

const CRLF = "\r\n";

function response(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      const complete = lines.filter(Boolean);
      if (!complete.length) return;
      const last = complete.at(-1);
      if (/^\d{3} /.test(last)) {
        cleanup();
        const code = Number(last.slice(0, 3));
        if (code >= 400) reject(Object.assign(new Error(`SMTP_${code}: ${complete.join(" | ")}`), { code, lines: complete }));
        else resolve({ code, lines: complete });
      }
    };
    const onError = error => { cleanup(); reject(error); };
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

const command = async (socket, text) => {
  socket.write(`${text}${CRLF}`);
  return response(socket);
};

function connect({ host, port, tls: useTls, tlsOptions = {}, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const socket = useTls
      ? tls.connect({ host, port, ...tlsOptions })
      : net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("SMTP_CONNECTION_TIMEOUT")); }, timeoutMs);
    const cleanup = () => clearTimeout(timer);
    socket.once(useTls ? "secureConnect" : "connect", () => { cleanup(); resolve(socket); });
    socket.once("error", error => { cleanup(); reject(error); });
    socket.setEncoding("utf8");
  });
}

export function smtpTransport({ host, port = 25, tls: useTls = false, tlsOptions = {}, helo = "node01.izakhono", username = null, password = null, requireTlsForAuth = true, timeoutMs = 15000 } = {}) {
  if (!host) throw new Error("SMTP_HOST_REQUIRED");
  return {
    name: `smtp:${host}:${port}`,
    mode: "owned-smtp",
    priority: 10,
    idempotent: true,
    enabled: true,
    async send(envelope) {
      const socket = await connect({ host, port, tls: useTls, tlsOptions, timeoutMs });
      try {
        const greeting = await response(socket);
        if (greeting.code !== 220) throw new Error(`SMTP_GREETING_${greeting.code}`);
        let ehlo = await command(socket, `EHLO ${helo}`);
        if (!useTls && tlsOptions?.key && tlsOptions?.cert) {
          // STARTTLS is enabled only when the caller explicitly supplies a STARTTLS-capable socket factory.
          // Direct TLS (465-style) is supported by this adapter; submission auth should use that secure channel.
        }
        if (username) {
          if (requireTlsForAuth && !useTls) throw new Error("SMTP_AUTH_REQUIRES_TLS");
          const token = Buffer.from(`\0${username}\0${password || ""}`, "utf8").toString("base64");
          await command(socket, `AUTH PLAIN ${token}`);
        }
        await command(socket, `MAIL FROM:<${envelope.from}>`);
        for (const recipient of envelope.to || []) await command(socket, `RCPT TO:<${recipient}>`);
        await command(socket, "DATA");
        const raw = String(envelope.raw || "").replace(/(^|\r?\n)\./g, "$1..");
        socket.write(`${raw}${raw.endsWith(CRLF) ? "" : CRLF}.${CRLF}`);
        const accepted = await response(socket);
        await command(socket, "QUIT");
        return { accepted: true, code: accepted.code, response: accepted.lines.at(-1) };
      } finally {
        socket.destroy();
      }
    }
  };
}
