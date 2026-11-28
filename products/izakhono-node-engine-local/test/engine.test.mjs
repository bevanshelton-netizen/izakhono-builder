import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createNodeEngine } from "../src/engine.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "iz-node-engine-"));
  await fs.writeFile(path.join(root, "index.html"), "<h1>same-device host</h1>");
  await fs.mkdir(path.join(root, "assets"));
  await fs.writeFile(path.join(root, "assets", "app.css"), "body { color: black; }");
  const engine = createNodeEngine({ siteRoot: root, port: 0 });
  t.after(async () => {
    await engine.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  return { engine, root };
}

test("starts loopback host and serves index from this process", async t => {
  const { engine } = await fixture(t);
  const status = await engine.start();
  assert.equal(status.state, "running");
  assert.equal(status.exposure, "loopback");
  assert.match(status.url, /^http:\/\/127\.0\.0\.1:/);
  const response = await fetch(status.url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /same-device host/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("serves files and supports HEAD", async t => {
  const { engine } = await fixture(t);
  const { url } = await engine.start();
  const css = await fetch(new URL("assets/app.css", url));
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type"), /text\/css/);
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("rejects methods other than GET and HEAD", async t => {
  const { engine } = await fixture(t);
  const { url } = await engine.start();
  const response = await fetch(url, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("does not serve missing files or directory listings", async t => {
  const { engine } = await fixture(t);
  const { url } = await engine.start();
  assert.equal((await fetch(new URL("missing.txt", url))).status, 404);
  assert.equal((await fetch(new URL("assets/", url))).status, 404);
});

test("requires explicit opt-in for non-loopback binding", async () => {
  assert.throws(() => createNodeEngine({ siteRoot: ".", host: "0.0.0.0" }), /exposeLan/);
});

test("stop closes the listener", async t => {
  const { engine } = await fixture(t);
  const status = await engine.start();
  await engine.stop();
  assert.equal(engine.status().state, "stopped");
  await assert.rejects(fetch(status.url));
});
