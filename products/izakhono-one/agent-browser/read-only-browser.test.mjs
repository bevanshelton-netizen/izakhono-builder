import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createReadOnlyBrowserAdapter } from "./read-only-browser.mjs";

async function fixture(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()))
  };
}

test("reads fixture HTML using GET and extracts visible text only", async () => {
  let method;
  const site = await fixture((req, res) => {
    method = req.method;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<html><head><title>Fixture &amp; Test</title><script>secret()</script></head><body><h1>Hello</h1><p>Read only <b>content</b></p></body></html>");
  });
  try {
    const adapter = createReadOnlyBrowserAdapter({ allowLocalFixtures: true });
    const result = await adapter.run({ type: "extract_text", url: site.url });
    assert.equal(result.ok, true);
    assert.equal(method, "GET");
    assert.equal(result.method, "GET");
    assert.equal(result.title, "Fixture & Test");
    assert.match(result.text, /Hello/);
    assert.match(result.text, /Read only content/);
    assert.doesNotMatch(result.text, /secret/);
  } finally {
    await site.close();
  }
});

test("rejects non-fixture destinations by default", async () => {
  const adapter = createReadOnlyBrowserAdapter();
  const result = await adapter.run({ type: "navigate", url: "http://127.0.0.1:1234" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "loopback_blocked");
});

test("follows same-origin redirects and records the count", async () => {
  const site = await fixture((req, res) => {
    if (req.url === "/start") {
      res.writeHead(302, { location: "/final" }).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" }).end("finished");
  });
  try {
    const result = await createReadOnlyBrowserAdapter({ allowLocalFixtures: true })
      .run({ type: "navigate", url: `${site.url}/start` });
    assert.equal(result.ok, true);
    assert.equal(result.redirects, 1);
    assert.equal(result.text, "finished");
  } finally {
    await site.close();
  }
});

test("blocks cross-origin redirects", async () => {
  const destination = await fixture((_req, res) => res.end("should not be fetched"));
  const origin = await fixture((_req, res) => {
    res.writeHead(302, { location: destination.url }).end();
  });
  try {
    const result = await createReadOnlyBrowserAdapter({ allowLocalFixtures: true })
      .run({ type: "navigate", url: origin.url });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "cross_origin_redirect_blocked");
  } finally {
    await Promise.all([origin.close(), destination.close()]);
  }
});

test("enforces response size and content-type limits", async () => {
  const large = await fixture((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" }).end("123456789");
  });
  const binary = await fixture((_req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" }).end("binary");
  });
  try {
    const adapter = createReadOnlyBrowserAdapter({ allowLocalFixtures: true, maxBytes: 8 });
    assert.equal((await adapter.run({ type: "navigate", url: large.url })).reason, "response_too_large");
    assert.equal((await adapter.run({ type: "navigate", url: binary.url })).reason, "unsupported_content_type");
  } finally {
    await Promise.all([large.close(), binary.close()]);
  }
});

test("returns a bounded timeout result", async () => {
  const slow = await fixture((_req, res) => setTimeout(() => {
    if (!res.destroyed) res.writeHead(200, { "content-type": "text/plain" }).end("late");
  }, 250));
  try {
    const result = await createReadOnlyBrowserAdapter({ allowLocalFixtures: true })
      .run({ type: "navigate", url: slow.url, timeoutMs: 1000 });
    assert.equal(result.ok, true);
  } finally {
    await slow.close();
  }
});

test("rejects all task fields that could enable interaction", async () => {
  const result = await createReadOnlyBrowserAdapter({ allowLocalFixtures: true })
    .run({ type: "navigate", url: "http://127.0.0.1:1234", click: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unknown_task_field");
});
