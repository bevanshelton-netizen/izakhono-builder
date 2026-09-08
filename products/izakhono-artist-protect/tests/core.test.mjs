import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSplits,contractRisk,clearance,survivalPlan,requiredContracts} from '../src/core.js';

test('splits must equal 100%',()=>{
  assert.equal(validateSplits([{party_id:'a',share_bps:6000},{party_id:'b',share_bps:4000}]).ok,true);
  assert.equal(validateSplits([{party_id:'a',share_bps:6000}]).ok,false);
});
test('dangerous contract requires lawyer',()=>{
  assert.equal(contractRisk({copyright_assignment:true,broad_power_of_attorney:true}).level,'lawyer_required');
});
test('uncleared sample blocks release',()=>{
  const r=clearance({
    identity_verified:true,master_owner_declared:true,
    composition_splits:[{party_id:'a',share_bps:10000}],
    master_splits:[{party_id:'a',share_bps:10000}],
    required_contributor_signatures_complete:true,
    contains_samples:true,sample_clearance_complete:false,
    platform_licence_granted:true
  });
  assert.equal(r.status,'blocked');
  assert.ok(r.blockers.includes('sample_clearance_missing'));
});
test('survival reserves never exceed payout',()=>{
  assert.equal(survivalPlan({tax_reserve_bps:1500,emergency_reserve_bps:1000,reinvestment_bps:1000}).available_bps,6500);
});
test('selects contracts from release facts',()=>{
  const docs=requiredContracts({writer_count:2,producer:true,platform_use:true});
  assert.deepEqual(docs.map(x=>x.code),['songwriter-split','producer-services','platform-licence']);
});
