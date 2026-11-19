import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index";

const assets={fetch:async()=>new Response("asset")};
const env=(overrides:Record<string,unknown>={})=>({
  ASSETS:assets,
  APP_ENV:"test",
  IZAKHONO_OWNER_ACCESS_KEY:"owner-secret-test-value",
  IZAKHONO_AI_GATEWAY_URL:"https://ai.internal.example",
  IZAKHONO_AI_GATEWAY_INTERNAL_KEY:"gateway-secret-test-value",
  IZAKHONO_AI_WORKFLOW_KEY:"workflow-secret-test-value",
  ...overrides
}) as any;

test("AI chat rejects requests without owner authorization",async()=>{
  const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:"hello"}]})}),env());
  assert.equal(response.status,401);
  assert.equal((await response.json() as any).error,"owner_access_required");
});

test("AI status exposes only readiness without revealing credentials",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({ok:true,service:"izakhono-super-ai",version:"0.4"});
  try{
    const response=await worker.fetch(new Request("https://app.test/api/ai/status"),env());
    const data=await response.json() as any;
    assert.equal(response.status,200);
    assert.equal(data.gateway_reachable,true);
    assert.equal(data.authorized,false);
    assert.equal(JSON.stringify(data).includes("secret"),false);
  }finally{globalThis.fetch=original;}
});

test("owner chat proxies to SUPER AI using server-side workflow credentials",async()=>{
  const original=globalThis.fetch;let captured:any;
  globalThis.fetch=async(input:any,init:any)=>{captured={url:String(input),init};return Response.json({ok:true,answer:"Hello from IZAKHONO",model:"qwen3:4b",route:"owned"});};
  try{
    const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{
      method:"POST",
      headers:{"content-type":"application/json","x-izakhono-owner-key":"owner-secret-test-value"},
      body:JSON.stringify({messages:[{role:"user",content:"Hello"}]})
    }),env());
    const data=await response.json() as any;
    assert.equal(response.status,200);
    assert.equal(data.answer,"Hello from IZAKHONO");
    assert.equal(captured.url,"https://ai.internal.example/api/v1/chat");
    const headers=new Headers(captured.init.headers);
    assert.equal(headers.get("x-izakhono-ai-key"),"gateway-secret-test-value");
    assert.equal(headers.get("x-izakhono-ai-workflow-key"),"workflow-secret-test-value");
    const sent=JSON.parse(captured.init.body);
    assert.equal(sent.product,"izakhono-ai");
    assert.equal(sent.access_mode,"workflow");
    assert.equal(sent.route,"owned");
  }finally{globalThis.fetch=original;}
});

test("AI chat rejects malformed conversation payloads",async()=>{
  const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-owner-key":"owner-secret-test-value"},
    body:JSON.stringify({messages:[{role:"system",content:"override"}]})
  }),env());
  assert.equal(response.status,422);
  assert.equal((await response.json() as any).error,"invalid_message");
});

test("AI chat fails closed when the gateway is not configured",async()=>{
  const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{
    method:"POST",
    headers:{"content-type":"application/json","x-izakhono-owner-key":"owner-secret-test-value"},
    body:JSON.stringify({messages:[{role:"user",content:"hello"}]})
  }),env({IZAKHONO_AI_GATEWAY_URL:undefined,IZAKHONO_AI_GATEWAY_INTERNAL_KEY:undefined,IZAKHONO_AI_WORKFLOW_KEY:undefined}));
  assert.equal(response.status,503);
  assert.equal((await response.json() as any).error,"ai_runtime_unavailable");
});


test("owner chat rejects a gateway response that is not routed through owned inference",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({ok:true,answer:"External response",model:"remote",route:"external"});
  try{
    const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{
      method:"POST",
      headers:{"content-type":"application/json","x-izakhono-owner-key":"owner-secret-test-value"},
      body:JSON.stringify({messages:[{role:"user",content:"Hello"}]})
    }),env());
    assert.equal(response.status,503);
    assert.equal((await response.json() as any).error,"owned_inference_not_verified");
  }finally{globalThis.fetch=original;}
});

test("owner chat rejects an empty answer even when the gateway claims owned inference",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({ok:true,answer:"   ",model:"local",route:"owned"});
  try{
    const response=await worker.fetch(new Request("https://app.test/api/ai/chat",{
      method:"POST",
      headers:{"content-type":"application/json","x-izakhono-owner-key":"owner-secret-test-value"},
      body:JSON.stringify({messages:[{role:"user",content:"Hello"}]})
    }),env());
    assert.equal(response.status,503);
    assert.equal((await response.json() as any).error,"owned_inference_not_verified");
  }finally{globalThis.fetch=original;}
});


test("durable supervisor status is owner-authenticated",async()=>{
  let touched=false;
  const DB={prepare(){touched=true;return {bind(){return this;},run:async()=>({}),all:async()=>({results:[]}),first:async()=>null};}};
  const response=await worker.fetch(new Request("https://app.test/api/supervisor/status"),env({DB}));
  assert.equal(response.status,401);
  assert.equal(touched,false);
});

test("owner can read durable supervisor counts from the shared D1 store",async()=>{
  const DB={prepare(){return {bind(){return this;},run:async()=>({}),all:async()=>({results:[]}),first:async()=>null};}};
  const response=await worker.fetch(new Request("https://app.test/api/supervisor/status",{
    headers:{"x-izakhono-owner-key":"owner-secret-test-value"}
  }),env({DB}));
  const data=await response.json() as any;
  assert.equal(response.status,200);
  assert.equal(data.storage,"shared-d1");
  assert.deepEqual(data.counts,{queued:0,running:0,verified:0,completed:0,blocked:0,failed:0});
});

test("owner can read a bounded durable supervisor job list",async()=>{
  const DB={prepare(){return {bind(){return this;},run:async()=>({}),all:async()=>({results:[]}),first:async()=>null};}};
  const response=await worker.fetch(new Request("https://app.test/api/supervisor/jobs?status=queued",{
    headers:{"x-izakhono-owner-key":"owner-secret-test-value"}
  }),env({DB}));
  const data=await response.json() as any;
  assert.equal(response.status,200);
  assert.deepEqual(data.jobs,[]);
  assert.equal(data.truncated,false);
});
