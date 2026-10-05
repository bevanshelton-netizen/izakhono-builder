import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthQueue, buildAttributionEvent, qualityGate, summarizeOps } from "../ops-engine.mjs";

test("growth queue prioritises commercial opportunities and requires approval",()=>{
  const q=buildGrowthQueue([{query:"uniform supplier south africa",intent:"commercial",opportunity:90},{query:"how to choose uniforms",intent:"informational",opportunity:70}],{domain:"example.co.za"});
  assert.equal(q[0].priority,"P1");
  assert.equal(q[0].publication.auto_publish,false);
  assert.equal(q[0].content_brief.human_review_required,true);
});

test("attribution never invents revenue",()=>{
  const e=buildAttributionEvent({event_type:"lead",landing_path:"/uniforms"});
  assert.equal(e.value,null);
  assert.equal(e.source,"first_party");
});

test("quality gate blocks unapproved thin content",()=>{
  const r=qualityGate({title:"Test",body:"short",hasHumanApproval:false,hasProductValue:true});
  assert.equal(r.passed,false);
  assert.equal(r.decision,"hold_for_review");
});

test("ops summary counts only supplied attribution events",()=>{
  const q=buildGrowthQueue([{query:"uniforms",intent:"commercial",opportunity:80}],{domain:"example.co.za"});
  const e=[buildAttributionEvent({event_type:"lead"}),buildAttributionEvent({event_type:"revenue",value:1250,currency:"ZAR"})];
  const s=summarizeOps(q,e);
  assert.equal(s.attribution.leads,1);
  assert.equal(s.attribution.revenue,1250);
});
