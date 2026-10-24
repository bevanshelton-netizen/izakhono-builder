import assert from "node:assert/strict";
import net from "node:net";
import { Node01MailServer } from "./node01-mail-server.mjs";

const received = [];
const runtime = {
  ingest(message) {
    received.push(message);
    return { disposition: "deliver" };
  },
  health() { return { queue: { size: 0 }, transports: [] }; },
};

const server = new Node01MailServer({
  runtime,
  host: "127.0.0.1",
  port: 0,
  submissionPort: 0,
  recipientPolicy: async () => true,
});
await server.start();
const smtpPort = server.servers[0].address().port;

const socket = net.createConnection({ host: "127.0.0.1", port: smtpPort });
socket.setEncoding("utf8");
let buffer = "";
const lines = [];
socket.on("data", chunk => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    lines.push(buffer.slice(0, i).replace(/\r$/, ""));
    buffer = buffer.slice(i + 1);
  }
});
const waitFor = async predicate => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 3000) throw new Error("SMTP_TEST_TIMEOUT");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return lines[lines.length - 1];
};

await waitFor(() => lines.some(line => line.startsWith("220 ")));
socket.write("EHLO node01.test\r\n");
await waitFor(() => lines.some(line => line.includes("IZAKHONO MAIL / NODE01")));
socket.write("MAIL FROM:<sender@example.test>\r\n");
await waitFor(() => lines.includes("250 2.1.0 sender ok"));
socket.write("RCPT TO:<recipient@example.test>\r\n");
await waitFor(() => lines.includes("250 2.1.5 recipient ok"));
socket.write("DATA\r\n");
await waitFor(() => lines.some(line => line.startsWith("354 ")));
socket.write("Subject: NODE01 transaction test\r\n\r\nhello\r\n.\r\n");
await waitFor(() => lines.includes("250 2.0.0 accepted for delivery"));
socket.write("QUIT\r\n");
await waitFor(() => lines.some(line => line.startsWith("221 ")));

assert.equal(received.length, 1);
assert.equal(received[0].from, "sender@example.test");
assert.deepEqual(received[0].to, ["recipient@example.test"]);
assert.match(received[0].raw, /Subject: NODE01 transaction test/);

socket.destroy();
await server.stop();
console.log("NODE01 SMTP transaction test PASSED");
