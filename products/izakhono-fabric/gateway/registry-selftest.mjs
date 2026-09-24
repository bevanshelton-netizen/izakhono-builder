import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const crm=JSON.parse(fs.readFileSync(new URL("../../izakhono-crm/portfolio-crm-registry.json",import.meta.url),"utf8"));
const adapters=JSON.parse(fs.readFileSync(new URL("./portfolio-adapters.json",import.meta.url),"utf8"));

test("every CRM platform has a scoped APP FABRIC adapter",()=>{
  for(const platform of crm.platforms){
    const adapter=adapters.platforms[platform.platform_id];
    assert.ok(adapter,`missing adapter for ${platform.platform_id}`);
    assert.equal(adapter.entity_id,platform.entity_id);
    assert.deepEqual(adapter.allowed_stages,platform.stages);
    assert.equal(adapter.active,!String(platform.entity_id).startsWith("TBD_"));
  }
});

test("public intake is explicit and does not expose payment confirmation",()=>{
  for(const adapter of Object.values(adapters.platforms)){
    assert.ok(Array.isArray(adapter.public_events));
    assert.equal(adapter.public_events.includes("payment.confirmed"),false);
  }
});
