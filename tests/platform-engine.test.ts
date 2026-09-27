import { strict as assert } from "node:assert";
import { validateTenantManifest, assertTenantBoundary, canPubliclyPublish } from "../src/platform-engine.js";

const edu = {
  schema_version:"1.0", tenant_id:"edubuild-shelton", tenant_class:"external-independent",
  legal_entity:"EDU-BUILD INSTITUTE – Shelton Campuses", portfolio_owner:false,
  launch_state:"private-until-verified",
  engine:{independently_deployable:true,health_endpoint:"/health"},
  isolation:{data:"dedicated",auth:"dedicated-scope",storage:"dedicated",secrets:"tenant-scoped",payments:"tenant-scoped",crm:"tenant-scoped",growth_contacts:"tenant-scoped",analytics:"tenant-scoped"},
  capabilities:{growth_engine:true},
  forbidden:["cross_tenant_data_access","cross_tenant_auth","cross_tenant_payment_destination","cross_tenant_growth_audience","cross_tenant_consent_or_suppression","shared_production_secrets"]
};

assert.deepEqual(validateTenantManifest(edu), []);
assert.equal(canPubliclyPublish(edu), false);
assert.throws(() => assertTenantBoundary(edu, "faisready", "crm"), /TENANT_BOUNDARY_DENIED/);
assert.doesNotThrow(() => assertTenantBoundary(edu, "edubuild-shelton", "crm"));
console.log("Platform Engine tenant isolation contract: PASS");
