import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { registryAuthorized } from "./security";

async function main() {
  const token = "test-only-registry-token";
  const hash = createHash("sha256").update(token).digest("hex");
  assert.equal(await registryAuthorized(undefined, `Bearer ${token}`), false, "missing configured hash must fail closed");
  assert.equal(await registryAuthorized("", `Bearer ${token}`), false, "empty configured hash must fail closed");
  assert.equal(await registryAuthorized(hash, undefined), false, "missing bearer token must be denied");
  assert.equal(await registryAuthorized(hash, "Basic abc"), false, "non-bearer authorization must be denied");
  assert.equal(await registryAuthorized(hash, "Bearer wrong-token"), false, "incorrect bearer token must be denied");
  assert.equal(await registryAuthorized(hash, `Bearer ${token}`), true, "correct bearer token must be accepted");
  console.log("registry security tests: ok (missing config, missing token, invalid scheme, invalid token, valid token)");
}
void main();
