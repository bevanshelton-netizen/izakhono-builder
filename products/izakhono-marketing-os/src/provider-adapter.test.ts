import { CredentialGatedProviderAdapter, ProviderAdapterRegistry } from "./provider-adapter";
import type { AdapterInstruction } from "./adapter-execution";

const instruction: AdapterInstruction = {
  schema: "izakhono.marketing.adapter-instruction.v1",
  campaignId: "campaign-provider-001",
  adapter: "owned",
  approvalId: "approval-provider-001",
  issuedAt: "2026-10-27T08:00:00+02:00",
  jobs: [{
    campaignId: "campaign-provider-001",
    network: "linkedin",
    text: "Provider boundary test",
    scheduledAt: "2026-10-27T09:00:00+02:00",
    status: "ready_for_adapter",
  }],
};

const registry = new ProviderAdapterRegistry();
registry.register(new CredentialGatedProviderAdapter("owned", true, () => "success"));

if (registry.execute(instruction) !== "success") throw new Error("Configured provider adapter must execute");

const blocked = new CredentialGatedProviderAdapter("metricool", false, () => "success");
let credentialBlocked = false;
try {
  blocked.execute({ ...instruction, adapter: "metricool" });
} catch {
  credentialBlocked = true;
}
if (!credentialBlocked) throw new Error("Unconfigured provider credentials must remain gated");

let mismatchBlocked = false;
try {
  registry.execute({ ...instruction, adapter: "metricool" });
} catch {
  mismatchBlocked = true;
}
if (!mismatchBlocked) throw new Error("Unregistered provider adapter must be blocked");

console.log("IZAKHONO MARKETING OS provider adapter boundary validated");
