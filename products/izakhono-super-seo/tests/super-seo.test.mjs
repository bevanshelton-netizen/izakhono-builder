import test from "node:test";
import assert from "node:assert/strict";
import { analyze, clusterKeywords, makePlan } from "../server.mjs";

test("keyword engine creates commercial and long-tail opportunities",()=>{
  const ks=clusterKeywords(["school uniforms","PPE"]);
  assert.ok(ks.length>5);
  assert.ok(ks.some(x=>x.intent==="commercial"));
  assert.ok(ks.some(x=>x.long_tail));
});

test("content plan maps keywords to pages",()=>{
  const plan=makePlan(clusterKeywords(["workwear"]),"example.co.za");
  assert.ok(plan.length>0);
  assert.match(plan[0].target_url,/https:\/\/example\.co\.za\/insights\//);
});

test("analysis enforces required inputs and returns guardrails",()=>{
  assert.throws(()=>analyze({domain:"example.co.za",seed_keywords:[]}),/seed keyword/);
  const x=analyze({domain:"example.co.za",seed_keywords:["PPE"],competitors:["rival.co.za"],pages:["https://example.co.za/ppe"]});
  assert.equal(x.schema,"izakhono.super-seo.analysis.v1");
  assert.ok(x.gaps.length>0);
  assert.ok(x.guardrails.some(x=>x.includes("backlink exchange")));
});
