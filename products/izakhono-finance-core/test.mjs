import assert from "node:assert/strict";
import fs from "node:fs";

const contract=JSON.parse(fs.readFileSync(new URL("./finance-core.v1.json",import.meta.url),"utf8"));
const product=JSON.parse(fs.readFileSync(new URL("./.izakhono.json",import.meta.url),"utf8"));
const compose=fs.readFileSync(new URL("./node01/docker-compose.yml",import.meta.url),"utf8");
const envExample=fs.readFileSync(new URL("./node01/.env.example",import.meta.url),"utf8");

assert.equal(contract.schema,"izakhono.finance-core.v1");
assert.equal(contract.version,"0.2.0");
assert.equal(contract.infrastructure.policy,"owned-first-externally-reversible");
assert.equal(contract.infrastructure.owned_target,"NODE01");
assert.equal(contract.privacy.behavioural_tracking,false);
assert.equal(contract.regulated_activity_boundary.deposit_taking_enabled,false);
assert.equal(contract.regulated_activity_boundary.credit_provider_enabled,false);
assert.equal(contract.regulated_activity_boundary.automated_final_credit_decisions_enabled,false);
assert.equal(contract.security.distinct_maker_checker_principals_required,true);
assert.equal(contract.security.audit_hash_chain_required,true);
assert.equal(contract.security.encrypted_persistence_required,true);
assert.equal(contract.security.backup_checksum_manifest_required,true);
assert.equal(contract.super_app_module.engine,"independent");
assert.equal(product.application_version,"0.2.0");
assert.match(compose,/127\.0\.0\.1:8797:8797/);
assert.match(compose,/no-new-privileges:true/);
assert.match(compose,/cap_drop:/);
assert.match(envExample,/FINANCE_ALLOW_INSECURE_LOCAL=false/);
assert.match(envExample,/FINANCE_DATA_KEY_FILE=/);

console.log(JSON.stringify({
  ok:true,
  product:contract.product,
  version:contract.version,
  maker_checker:true,
  audit_hash_chain:true,
  node01_pack:true,
  public_live:false
},null,2));
