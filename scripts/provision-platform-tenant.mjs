import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const [manifestPath, outputRoot] = process.argv.slice(2);
if (!manifestPath || !outputRoot) throw new Error("Usage: node scripts/provision-platform-tenant.mjs <manifest.json> <output-directory>");
const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
const slug = manifest.tenant_id;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) throw new Error("Invalid tenant slug");
if (!["internal", "external-independent"].includes(manifest.tenant_class)) throw new Error("Invalid tenant class");
if (!manifest.engine?.independently_deployable) throw new Error("Independent engine required");
if (!manifest.legal_entity?.trim()) throw new Error("Legal entity required");
const required = ["data","auth","storage","secrets","payments","crm","growth_contacts","analytics"];
for (const key of required) if (!manifest.isolation?.[key]) throw new Error("Missing isolation: " + key);
const forbidden = ["cross_tenant_data_access","cross_tenant_auth","cross_tenant_payment_destination","cross_tenant_growth_audience","cross_tenant_consent_or_suppression","shared_production_secrets"];
if (manifest.tenant_class === "external-independent") {
  if (manifest.portfolio_owner !== false) throw new Error("External tenant cannot be portfolio owned");
  for (const rule of forbidden) if (!manifest.forbidden?.includes(rule)) throw new Error("Missing boundary rule: " + rule);
}
if (manifest.launch_state === "live-verified") throw new Error("Provisioner cannot declare a tenant live");
const destination = resolve(outputRoot, slug);
mkdirSync(destination, { recursive: true });
const deployment = {
  schema_version: "1.0", tenant_id: slug, tenant_class: manifest.tenant_class,
  legal_entity: manifest.legal_entity, status: "GENERATED_NOT_DEPLOYED",
  runtime: { independent: true, health_path: manifest.engine.health_endpoint },
  bindings: Object.fromEntries(required.map(key => [key, { scope: slug, mode: manifest.isolation[key], provisioned: false }])),
  capabilities: manifest.capabilities,
  public_publishing_allowed: false,
  secrets: "REFERENCES_ONLY",
  owned_route: "NOT_VERIFIED", external_route: "NOT_VERIFIED",
  acceptance: { cross_tenant_access: "PENDING", payment_isolation: "PENDING", growth_isolation: "PENDING", failure_isolation: "PENDING", backup_restore: "PENDING" }
};
writeFileSync(join(destination, "deployment.contract.json"), JSON.stringify(deployment, null, 2) + "\n");
writeFileSync(join(destination, "tenant.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
writeFileSync(join(destination, "provisioning.evidence.json"), JSON.stringify({ tenant_id: slug, manifest_sha256: digest, result: "CONTRACT_GENERATED", deployment: "NOT_ATTEMPTED", tests: "NOT_RUN" }, null, 2) + "\n");
console.log(JSON.stringify({ tenant_id: slug, result: "CONTRACT_GENERATED", destination, deployment: "NOT_ATTEMPTED" }));
