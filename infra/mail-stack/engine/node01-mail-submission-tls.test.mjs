import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import tls from "node:tls";
import { Node01MailServer } from "./node01-mail-server.mjs";

const dir = mkdtempSync(join(tmpdir(), "izakhono-node01-tls-"));
const keyPath = join(dir, "key.pem");
const certPath = join(dir, "cert.pem");

function waitForLine(socket, expected) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith(expected)) {
          cleanup();
          resolve(line);
          return;
        }
      }
    };
    const onError = error => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error(`CONNECTION_CLOSED_WAITING_FOR_${expected}`)); };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function command(socket, text, expected) {
  socket.write(`${text}\r\n`);
  return waitForLine(socket, expected);
}

try {
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=node01.test", "-keyout", keyPath, "-out", certPath
  ], { stdio: "ignore" });

  const received = [];
  const runtime = {
    ingest(message) {
      received.push(message);
      return { disposition: "deliver" };
    }
  };

  const server = new Node01MailServer({
    runtime,
    host: "127.0.0.1",
    port: 0,
    submissionPort: 0,
    tlsOptions: {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath)
    },
    auth: async (username, password) => username === "sender@izakhono.test" && password === "secret",
    recipientPolicy: async () => true,
    requireTlsForAuth: true
  });

  // The server currently exposes configured ports rather than resolved ephemeral ports.
  // Use a deterministic free port pair for this protocol test.
  await server.stop();
  const freePort = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const p = probe.address().port;
      probe.close(() => resolve(p));
    });
    probe.on("error", reject);
  });
  server.port = freePort;
  server.submissionPort = freePort + 1;
  await server.start();

  const client = net.createConnection({ host: "127.0.0.1", port: server.submissionPort });
  await waitForLine(client, "220 ");
  await command(client, "EHLO client.test", "250-");
  await command(client, "AUTH PLAIN", "538 ");
  await command(client, "STARTTLS", "220 ");

  const secure = tls.connect({
    socket: client,
    rejectUnauthorized: false,
    servername: "node01.test"
  });
  await new Promise((resolve, reject) => {
    secure.once("secureConnect", resolve);
    secure.once("error", reject);
  });
  secure.setEncoding("utf8");

  await command(secure, "EHLO client.test", "250-");
  const authPayload = Buffer.from("\0sender@izakhono.test\0secret", "utf8").toString("base64");
  await command(secure, `AUTH PLAIN ${authPayload}`, "235 ");
  await command(secure, "MAIL FROM:<sender@izakhono.test>", "250 ");
  await command(secure, "RCPT TO:<recipient@izakhono.test>", "250 ");
  await command(secure, "DATA", "354 ");
  secure.write("Subject: NODE01 STARTTLS submission test\r\n\r\nAuthenticated submission\r\n.\r\n");
  await waitForLine(secure, "250 ");
  await command(secure, "QUIT", "221 ");
  secure.destroy();

  assert.equal(received.length, 1);
  assert.equal(received[0].authenticated, true);
  assert.equal(received[0].direction, "outbound");
  assert.equal(received[0].authUser, "sender@izakhono.test");
  assert.equal(received[0].from, "sender@izakhono.test");
  assert.deepEqual(received[0].to, ["recipient@izakhono.test"]);

  await server.stop();
  console.log("NODE01 authenticated STARTTLS submission test PASSED");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
