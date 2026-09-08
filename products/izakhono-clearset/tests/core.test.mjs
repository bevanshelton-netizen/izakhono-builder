import test from 'node:test';
import assert from 'node:assert/strict';
import {clearset,requireTaxProfessional,settlementReady} from '../src/core.js';
test('available cash is net of obligations',()=>assert.equal(clearset({gross_minor:100000,vat_reserve_minor:13043,provider_cost_minor:3000,refund_reserve_minor:2000}).available_minor,81957));
test('cannot release more than gross',()=>assert.throws(()=>clearset({gross_minor:100,vat_reserve_minor:101})));
test('cross-border escalates tax review',()=>assert.equal(requireTaxProfessional({cross_border:true}),true));
test('dispute blocks settlement',()=>assert.equal(settlementReady({identity_resolved:true,beneficial_owner_resolved:true,ledger_posted:true,obligations_classified:true,reserve_funding_confirmed:true,active_dispute:true}),false));
