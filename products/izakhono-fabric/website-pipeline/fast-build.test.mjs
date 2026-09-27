import test from "node:test";
import assert from "node:assert/strict";
import { buildPreview, validateBrief } from "./fast-build.mjs";

test("rejects incomplete critical brief",()=>{
  const errors=validateBrief({business_name:"Acme"});
  assert(errors.some(e=>e.includes("offer")));
  assert(errors.some(e=>e.includes("primary_cta")));
});

test("builds accurate private preview without inventing missing facts",()=>{
  const r=buildPreview({
    business_name:"Acme Africa",
    offer:"Industrial maintenance and engineering services for commercial clients.",
    primary_cta:"Request a quote"
  });
  assert.equal(r.ok,true);
  assert.equal(r.qa.publish_candidate,false);
  assert.match(r.html,/Services to confirm/);
  assert.doesNotMatch(r.html,/testimonial|award-winning|best in africa/i);
  assert.match(r.html,/noindex,nofollow/);
});

test("verified complete brief can become publish candidate",()=>{
  const r=buildPreview({
    business_name:"Acme Africa",
    legal_entity:"Acme Africa (Pty) Ltd",
    registration_number:"2026/123456/07",
    offer:"Industrial maintenance and engineering services for commercial clients.",
    primary_cta:"Request a quote",
    contact_email:"info@example.com",
    services:[{name:"Maintenance",description:"Planned industrial maintenance for commercial facilities."}]
  });
  assert.equal(r.ok,true);
  assert.equal(r.qa.publish_candidate,true);
  assert.equal(r.qa.score,100);
  assert.match(r.html,/info@example\.com/);
  assert.match(r.html,/2026\/123456\/07/);
});
