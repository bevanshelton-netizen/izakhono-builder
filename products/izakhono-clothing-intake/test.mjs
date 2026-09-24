import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("clothing quote intake is wired only to quote.requested",()=>{
  const app=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");
  assert.match(app,/platform_id:"izakhono-clothing"/);
  assert.match(app,/event_type:"quote\.requested"/);
  assert.doesNotMatch(app,/payment\.confirmed/);
  assert.match(app,/localStorage/);
  assert.match(app,/yfawrenhudjomhnglfhq\.supabase\.co\/functions\/v1\/izakhono-gateway-event/);
  assert.match(app,/fabric_bridge:true/);
});
