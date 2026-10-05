import test from "node:test";
import assert from "node:assert/strict";
import { analyze, clusterKeywords, makePlan, extractPage, isPrivateIp } from "../server.mjs";

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

test("page parser extracts technical SEO signals",()=>{
  const html=`<html><head><title>Workwear South Africa</title><meta name="description" content="Industrial workwear supplier"><meta name="robots" content="index,follow"><link rel="canonical" href="https://example.co.za/workwear"><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>Workwear</h1><p>${"useful content ".repeat(120)}</p><a href="/ppe">PPE</a></body></html>`;
  const p=extractPage(html,"https://example.co.za/workwear");
  assert.equal(p.title,"Workwear South Africa");
  assert.equal(p.description,"Industrial workwear supplier");
  assert.equal(p.h1[0],"Workwear");
  assert.equal(p.noindex,false);
  assert.equal(p.json_ld_blocks,1);
  assert.ok(p.word_count>100);
  assert.ok(p.links.includes("https://example.co.za/ppe"));
});

test("network guard identifies private IPv4 and IPv6 ranges",()=>{
  for(const ip of ["10.0.0.1","127.0.0.1","169.254.1.1","172.16.0.1","192.168.1.1","::1","fd00::1","fe80::1"])assert.equal(isPrivateIp(ip),true,ip);
  assert.equal(isPrivateIp("8.8.8.8"),false);
});
