import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorSplit,classifyRevenue,canOverrideCreatorFee,bookingTransition} from '../src/core.js';

test('creator default is 90/10',()=>assert.deepEqual(creatorSplit(100000),{gross_minor:100000,platform_fee_minor:10000,creator_minor:90000,fee_bps:1000}));
test('ALLEGRO own ad income is not creator split',()=>assert.deepEqual(classifyRevenue({kind:'radio_advertising'}),{beneficial_owner:'izakhono',creator_split:false}));
test('creator royalties are split',()=>assert.equal(classifyRevenue({kind:'creator_royalty'}).creator_split,true));
test('fee override requires approved written reference',()=>{assert.equal(canOverrideCreatorFee({agreementReference:'AG-42',approved:true}),true);assert.equal(canOverrideCreatorFee({agreementReference:'',approved:true}),false)});
test('booking state machine rejects skips',()=>assert.throws(()=>bookingTransition('submitted','delivered')));
