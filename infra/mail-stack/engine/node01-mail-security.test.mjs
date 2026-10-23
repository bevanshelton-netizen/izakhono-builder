import assert from "node:assert/strict";
import { createConnectionLimiter, createCredentialAuth, createRecipientPolicy, normalizeEmail } from "./node01-mail-security.mjs";

assert.equal(normalizeEmail(" CEO@IZAKHONOAFRICA.CO.ZA "), "ceo@izakhonoafrica.co.za");
assert.throws(() => normalizeEmail("bad address"), /INVALID_EMAIL_ADDRESS/);

const local = createRecipientPolicy({ localDomains: ["izakhonoafrica.co.za"] });
assert.equal(await local("ceo@izakhonoafrica.co.za", { submission: false, authenticated: false }), true);
assert.equal(await local("user@example.com", { submission: false, authenticated: false }), false);
assert.equal(await local("user@example.com", { submission: true, authenticated: true }), true);

const auth = createCredentialAuth(async (user, password) => user === "ceo@izakhonoafrica.co.za" && password === "secret");
assert.equal(await auth("CEO@IZAKHONOAFRICA.CO.ZA", "secret"), true);
assert.equal(await auth("CEO@IZAKHONOAFRICA.CO.ZA", "wrong"), false);

const limiter = createConnectionLimiter({ maxConnections: 2, maxConnectionsPerIp: 1 });
assert.equal(limiter.acquire("1.2.3.4"), true);
assert.equal(limiter.acquire("1.2.3.4"), false);
assert.equal(limiter.acquire("5.6.7.8"), true);
assert.equal(limiter.acquire("9.9.9.9"), false);
limiter.release("1.2.3.4");
assert.equal(limiter.acquire("9.9.9.9"), true);

console.log("NODE01 MAIL security tests PASSED");
