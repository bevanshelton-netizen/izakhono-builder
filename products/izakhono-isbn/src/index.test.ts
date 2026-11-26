import assert from "node:assert/strict";
import worker, { validIsbn13 } from "./index.js";

assert.equal(validIsbn13("9780306406157"), true, "known valid ISBN-13");
assert.equal(validIsbn13("978-0-306-40615-7"), true, "hyphenated ISBN-13");
assert.equal(validIsbn13("9780306406158"), false, "incorrect checksum");
assert.equal(validIsbn13("9791090636071"), true, "valid 979 ISBN-13");
assert.equal(validIsbn13("978030640615"), false, "too short");
assert.equal(validIsbn13("9770306406157"), false, "non-book EAN prefix");
assert.equal(validIsbn13("978030640615X"), false, "non-numeric check digit");

const health = await worker.fetch(new Request("https://registry.example/api/health"), {});
assert.equal(health.status, 200, "health endpoint is public");
assert.equal((await health.json()).productionReady, false, "foundation is not presented as production-ready");

const unauthorized = await worker.fetch(new Request("https://registry.example/api/dashboard"), { ISBN_ADMIN_TOKEN: "test-token" });
assert.equal(unauthorized.status, 401, "management API rejects missing bearer token");

const noDatabase = await worker.fetch(new Request("https://registry.example/api/dashboard", {
  headers: { Authorization: "Bearer test-token" }
}), { ISBN_ADMIN_TOKEN: "test-token" });
assert.equal(noDatabase.status, 503, "management API fails closed without database");

console.log("ISBN registry tests passed (11 assertions).");
