import assert from "node:assert/strict";
import { buildMailboxPlan, buildProvisioningPlan, normalizeAddress } from "./mailbox-builder.mjs";

assert.equal(normalizeAddress(" Bevan@Example.COM "), "bevan@example.com");
assert.throws(() => normalizeAddress("not-an-email"));

const plan = buildMailboxPlan({
  address: "bevan@izakhono.example",
  displayName: "Bevan Shelton",
  quotaMb: 4096,
  aliases: ["ceo@izakhono.example", "CEO@IZAKHONO.EXAMPLE", "bevan@izakhono.example"]
});

assert.equal(plan.address, "bevan@izakhono.example");
assert.deepEqual(plan.aliases, ["ceo@izakhono.example"]);
assert.equal(plan.quotaMb, 4096);
assert.equal(plan.auth.passwordProvisioned, false);
assert.equal(plan.policy.externalAutoForwardAllowed, false);

const provisioning = buildProvisioningPlan({ address: "bevan@izakhono.example" });
assert.equal(provisioning.kind, "IZAKHONO_MAILBOX_PROVISIONING_PLAN");
assert.ok(provisioning.steps.includes("create-mailbox"));
assert.ok(provisioning.steps.includes("run-send-receive-verification"));
assert.ok(provisioning.steps.includes("mark-live-only-after-verification"));

console.log("IZAKHONO Mailbox Host Builder tests PASSED");
