import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthPlan, buildContentBrief } from "../growth-engine.mjs";

test("builds a revenue-oriented campaign plan without inventing metrics",()=>{
  const out=buildGrowthPlan({domain:"example.co.za",opportunities:[
    {query:"uniform supplier south africa",opportunity:91,intent:"commercial",competitor_gap:true},
    {query:"how to choose school uniforms",opportunity:82,intent:"informational"}
  ]});
  assert.equal(out.schema,"izakhono.super-seo.growth.v4");
  assert.equal(out.campaigns.length,2);
  assert.equal(out.campaigns[0].conversion_goal,"lead");
  assert.equal(out.attribution.rules.some(x=>x.includes("Do not claim revenue")),true);
  assert.equal("search_volume" in out,false);
});

test("creates a content brief tied to a campaign",()=>{
  const b=buildContentBrief({id:"growth-1",query:"school uniform supplier",intent:"commercial",target_url:"https://example.co.za/insights/school-uniform-supplier",title:"School Uniform Supplier"});
  assert.equal(b.keyword,"school uniform supplier");
  assert.equal(b.quality_gate.includes("Human approved"),true);
});

test("rejects missing domain",()=>assert.throws(()=>buildGrowthPlan({opportunities:[]}),/domain is required/));
