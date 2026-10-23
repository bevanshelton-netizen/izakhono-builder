import assert from "node:assert/strict";
import { probeDnsMx, probeTcp, probeTls } from "./node01-mail-probes.mjs";

const mx = await probeDnsMx("gmail.com");
assert.equal(mx.ok, true);
assert.equal(mx.source, "node01-mail-probe:dnsMx");
assert.ok(Array.isArray(mx.records));

const closed = await probeTcp("127.0.0.1", 1, 500);
assert.equal(closed.ok, false);
assert.ok(closed.source.startsWith("node01-mail-probe:1"));

const tls = await probeTls("example.com", 443, 5000);
assert.equal(tls.ok, true);
assert.equal(tls.authorized, true);
assert.ok(tls.protocol);

console.log("NODE01 mail real probe tests PASSED");
