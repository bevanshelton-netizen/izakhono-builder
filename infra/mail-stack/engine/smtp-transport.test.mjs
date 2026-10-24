import assert from "node:assert/strict";
import net from "node:net";
import { smtpTransport } from "./smtp-transport.mjs";

const received = [];
const server = net.createServer(socket => {
  socket.setEncoding("utf8");
  socket.write("220 test-smtp ESMTP ready\r\n");
  let buffer = "";
  let dataMode = false;
  socket.on("data", chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (dataMode) {
        if (line === ".") {
          dataMode = false;
          received.push("DATA_END");
          socket.write("250 2.0.0 queued reply-id=owned-test-001\r\n");
        } else received.push(line);
        continue;
      }
      if (/^EHLO /i.test(line)) socket.write("250-test-smtp\r\n250 AUTH PLAIN\r\n");
      else if (/^MAIL FROM:/i.test(line)) { received.push(line); socket.write("250 2.1.0 sender ok\r\n"); }
      else if (/^RCPT TO:/i.test(line)) { received.push(line); socket.write("250 2.1.5 recipient ok\r\n"); }
      else if (line === "DATA") { dataMode = true; socket.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
      else if (line === "QUIT") socket.end("221 2.0.0 closing\r\n");
      else socket.write("250 2.0.0 ok\r\n");
    }
  });
});

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.once("error", reject);
});

try {
  const port = server.address().port;
  const transport = smtpTransport({ host: "127.0.0.1", port });
  const result = await transport.send({
    from: "sender@izakhono.test",
    to: ["recipient@izakhono.test"],
    raw: "Subject: NODE01 outbound test\r\n\r\nOutbound reply-loop verification\r\n"
  });

  assert.equal(result.accepted, true);
  assert.equal(result.code, 250);
  assert.match(result.response, /queued reply-id=owned-test-001/);
  assert.ok(received.some(line => line.includes("MAIL FROM:<sender@izakhono.test>")));
  assert.ok(received.some(line => line.includes("RCPT TO:<recipient@izakhono.test>")));
  assert.ok(received.includes("Subject: NODE01 outbound test"));
  assert.ok(received.includes("DATA_END"));
  console.log("IZAKHONO outbound SMTP transport/reply-loop test PASSED");
} finally {
  await new Promise(resolve => server.close(resolve));
}
