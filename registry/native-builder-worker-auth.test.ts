import { strict as assert } from "node:assert";
import {
  authenticateNativeBuilderWorker,
  issueNativeBuilderWorkerCredential,
} from "./native-builder-worker-auth.js";

async function run(): Promise<void> {
  const issued = await issueNativeBuilderWorkerCredential("node01");
  assert.match(issued.token, /^nbw_[0-9a-f]{64}$/);
  assert.equal(issued.credentialHash.length, 64);
  assert.notEqual(issued.credentialHash, issued.token);

  let queriedHash = "";
  const db = {
    prepare(sql: string) {
      assert.match(sql, /credential_hash = \\?1/);
      return {
        bind(hash: unknown) {
          queriedHash = String(hash);
          return {
            async first<T>() {
              return ({ worker_id: "node01" } as T);
            },
          };
        },
      };
    },
  };
  const identity = await authenticateNativeBuilderWorker(db, "Bearer " + issued.token);
  assert.deepEqual(identity, { workerId: "node01" });
  assert.equal(queriedHash, issued.credentialHash);
  assert.equal(await authenticateNativeBuilderWorker(db, "Bearer invalid"), null);
  assert.equal(await authenticateNativeBuilderWorker(db, null), null);
  console.log("[PASS] Native Builder worker identity is derived from a hashed bearer credential.");
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
