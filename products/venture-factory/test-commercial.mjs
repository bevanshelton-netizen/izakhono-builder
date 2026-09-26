import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'izakhono-vf-commercial-'));
const vfPort = 19880;
const idPort = 19881;
const accessPort = 19882;
const payPort = 19883;

let lastPayRequest = null;

function jsonServer(handler) {
  return http.createServer(async (req,res)=>{
    const send=(status,body)=>{
      const raw=Buffer.from(JSON.stringify(body));
      res.writeHead(status,{'content-type':'application/json','content-length':String(raw.length)});
      res.end(raw);
    };
    try { await handler(req,res,send); }
    catch (e) { send(500,{error:String(e?.message||e)}); }
  });
}

async function readJson(req) {
  let raw='';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const id = jsonServer(async(req,res,send)=>{
  if(req.method==='POST' && req.url==='/api/v1/login'){
    const body=await readJson(req);
    if(body.email==='prospect@example.com' && body.password==='correct-horse-battery-staple' && body.entity_slug==='izakhono-africa'){
      return send(200,{ok:true,access_token:'prospect-token',token_type:'Bearer',expires_at:'2099-01-01T00:00:00+00:00',subject:body.email,entity:{id:'entity-customer',slug:'izakhono-africa'},role:'member',mfa:false});
    }
    if(body.email==='mfa@example.com' && body.password==='correct-horse-battery-staple' && body.entity_slug==='izakhono-africa'){
      return send(202,{ok:true,mfa_required:true,challenge_token:'challenge-mfa-test',challenge_expires_at:'2099-01-01T00:00:00+00:00',methods:['totp','recovery_code'],subject:body.email,entity:{id:'entity-customer',slug:'izakhono-africa'}});
    }
    return send(401,{error:'invalid_credentials'});
  }
  if(req.method==='POST' && req.url==='/api/v1/login/mfa'){
    const body=await readJson(req);
    if(body.challenge_token==='challenge-mfa-test' && (body.code==='123456' || body.recovery_code==='ABCD-EFGH-IJKL-MNOP')){
      return send(200,{ok:true,access_token:'mfa-token',token_type:'Bearer',expires_at:'2099-01-01T00:00:00+00:00',subject:'mfa@example.com',entity:{id:'entity-customer',slug:'izakhono-africa'},role:'member',mfa:true});
    }
    return send(401,{error:'invalid_mfa_code'});
  }
  if(req.method==='POST' && req.url==='/api/v1/logout') return send(200,{ok:true});
  if(req.method!=='POST' || req.url!=='/api/v1/internal/introspect') return send(404,{error:'not_found'});
  if(req.headers['x-izakhono-id-internal-key']!=='id-test') return send(401,{error:'unauthorized'});
  const body=await readJson(req);
  if(body.token==='subscriber-token') return send(200,{ok:true,active:true,subject:'subscriber@example.com',entity_id:'entity-customer',entity_slug:'customer',role:'member'});
  if(body.token==='prospect-token') return send(200,{ok:true,active:true,subject:'prospect@example.com',entity_id:'entity-customer',entity_slug:'customer',role:'member'});
  if(body.token==='mfa-token') return send(200,{ok:true,active:true,subject:'mfa@example.com',entity_id:'entity-customer',entity_slug:'customer',role:'member'});
  return send(200,{ok:true,active:false});
});

const access = jsonServer(async(req,res,send)=>{
  if(req.method!=='POST' || req.url!=='/api/v1/check') return send(404,{error:'not_found'});
  if(req.headers['x-izakhono-access-key']!=='access-test') return send(401,{error:'unauthorized'});
  const body=await readJson(req);
  if(body.subject==='subscriber@example.com' && body.product==='venture-factory') {
    return send(200,{ok:true,active:true,entitlement:{entity_id:body.entity_id,subject:body.subject,product:body.product,plan:'monthly'},usage_policy:{usage_credit_gate:false,message_quota:null,session_quota:null,fair_use:true}});
  }
  return send(200,{ok:true,active:false,entitlement:null,usage_policy:{usage_credit_gate:false,message_quota:null,session_quota:null,fair_use:true}});
});

const pay = jsonServer(async(req,res,send)=>{
  if(req.method!=='POST' || req.url!=='/api/v1/intents') return send(404,{error:'not_found'});
  if(req.headers['x-izakhono-key']!=='pay-test' || req.headers['x-izakhono-app']!=='venture-factory') return send(401,{error:{message:'unauthorized'}});
  if(!req.headers['idempotency-key']) return send(422,{error:{message:'idempotency required'}});
  const body=await readJson(req);
  lastPayRequest={headers:req.headers,body};
  return send(201,{ok:true,intent:{id:'pi_test',status:'requires_action',checkout_method:'redirect',checkout_url:'https://payments.example.test/checkout/pi_test'}});
});

await Promise.all([
  new Promise((resolve,reject)=>{id.once('error',reject);id.listen(idPort,'127.0.0.1',resolve)}),
  new Promise((resolve,reject)=>{access.once('error',reject);access.listen(accessPort,'127.0.0.1',resolve)}),
  new Promise((resolve,reject)=>{pay.once('error',reject);pay.listen(payPort,'127.0.0.1',resolve)}),
]);

const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('.',import.meta.url),
  env:{
    ...process.env,
    PORT:String(vfPort),
    VENTURE_FACTORY_HOST:'127.0.0.1',
    VENTURE_FACTORY_DATA_DIR:dataDir,
    VENTURE_FACTORY_OWNER_KEY:'owner-test',
    VENTURE_FACTORY_PUBLIC_PLANNING:'false',
    VENTURE_FACTORY_CUSTOMER_MODE:'true',
    IZAKHONO_SUPER_AI_INTERNAL_KEY:'',
    IZAKHONO_SUPER_AI_WORKFLOW_KEY:'',
    IZAKHONO_ID_URL:'http://127.0.0.1:'+idPort,
    IZAKHONO_ID_INTERNAL_KEY:'id-test',
    IZAKHONO_ACCESS_URL:'http://127.0.0.1:'+accessPort,
    IZAKHONO_ACCESS_INTERNAL_KEY:'access-test',
    VENTURE_FACTORY_ACCESS_ENTITY_ID:'izakhono-africa',
    IZAKHONO_PAY_URL:'http://127.0.0.1:'+payPort,
    IZAKHONO_PAY_API_KEY:'pay-test',
    IZAKHONO_PAY_APP_SLUG:'venture-factory',
    VENTURE_FACTORY_PRICE_MINOR:'49900',
    VENTURE_FACTORY_ACCESS_PLAN:'monthly',
    VENTURE_FACTORY_ACCESS_PERIOD_DAYS:'30',
    VENTURE_FACTORY_PUBLIC_ORIGIN:'https://venture.example.test',
    IZAKHONO_BUILDER_URL:'',
    IZAKHONO_BUILDER_ADMIN_KEY:'',
  },
  stdio:['ignore','pipe','pipe'],
});

async function waitForHealth(){
  for(let i=0;i<50;i++){
    try{
      const r=await fetch('http://127.0.0.1:'+vfPort+'/healthz');
      if(r.ok)return r.json();
    }catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('health_timeout');
}

const ideaPayload={
  idea:'AI service business planner for electricians and plumbers',
  country:'South Africa',
  monthly_price_zar:499,
  target_monthly_revenue_zar:100000,
};

try{
  const health=await waitForHealth();
  if(!health.customer_mode || !health.customer_stack_configured || !health.checkout_configured) throw new Error('commercial_health_contract_failed');

  const login=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/login',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({email:'prospect@example.com',password:'correct-horse-battery-staple',entity_slug:'izakhono-africa'}),
  });
  const loginBody=await login.json();
  if(!login.ok || loginBody.access_token!=='prospect-token') throw new Error('customer_login_failed');

  const mfaLogin=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/login',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({email:'mfa@example.com',password:'correct-horse-battery-staple',entity_slug:'izakhono-africa'}),
  });
  const mfaLoginBody=await mfaLogin.json();
  if(mfaLogin.status!==202 || mfaLoginBody.mfa_required!==true || mfaLoginBody.challenge_token!=='challenge-mfa-test') throw new Error('mfa_challenge_proxy_failed');

  const mfaComplete=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/login/mfa',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({challenge_token:mfaLoginBody.challenge_token,code:'123456'}),
  });
  const mfaCompleteBody=await mfaComplete.json();
  if(!mfaComplete.ok || mfaCompleteBody.access_token!=='mfa-token' || mfaCompleteBody.mfa!==true) throw new Error('mfa_completion_proxy_failed');

  const missing=await fetch('http://127.0.0.1:'+vfPort+'/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ideaPayload)});
  if(missing.status!==401) throw new Error('missing_auth_not_rejected');

  const prospect=await fetch('http://127.0.0.1:'+vfPort+'/api/plan',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer prospect-token'},body:JSON.stringify(ideaPayload)});
  const prospectBody=await prospect.json();
  if(prospect.status!==402 || prospectBody.checkout_available!==true) throw new Error('subscription_gate_failed');

  const session=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/session',{headers:{'authorization':'Bearer prospect-token'}});
  const sessionBody=await session.json();
  if(!session.ok || sessionBody.access?.active!==false || sessionBody.checkout_available!==true) throw new Error('session_contract_failed');

  const checkout=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/checkout',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'authorization':'Bearer prospect-token',
      'idempotency-key':'prospect-checkout-0001',
    },
    body:JSON.stringify({}),
  });
  const checkoutBody=await checkout.json();
  if(checkout.status!==201 || checkoutBody.pending!==true || checkoutBody.intent?.checkout_url!=='https://payments.example.test/checkout/pi_test') throw new Error('checkout_contract_failed');
  if(lastPayRequest?.body?.metadata?.access_product!=='venture-factory') throw new Error('access_metadata_missing');
  if(lastPayRequest?.body?.metadata?.access_subject!=='prospect@example.com') throw new Error('access_subject_missing');
  if(lastPayRequest?.body?.amount_minor!==49900) throw new Error('checkout_price_mismatch');

  const logout=await fetch('http://127.0.0.1:'+vfPort+'/api/customer/logout',{
    method:'POST',
    headers:{'authorization':'Bearer prospect-token'},
  });
  if(!logout.ok) throw new Error('customer_logout_failed');

  const subscriber=await fetch('http://127.0.0.1:'+vfPort+'/api/plan',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer subscriber-token'},body:JSON.stringify(ideaPayload)});
  const subscriberBody=await subscriber.json();
  if(!subscriber.ok || subscriberBody.access_mode!=='subscriber' || subscriberBody.subject!=='subscriber@example.com') throw new Error('subscriber_plan_failed');

  const ownerOnly=await fetch('http://127.0.0.1:'+vfPort+'/api/plans',{headers:{'authorization':'Bearer subscriber-token'}});
  if(ownerOnly.status!==401) throw new Error('owner_route_exposed_to_subscriber');

  console.log('IZAKHONO_VENTURE_FACTORY_COMMERCIAL_TEST=PASS');
} finally {
  child.kill('SIGTERM');
  await Promise.all([
    new Promise(resolve=>id.close(resolve)),
    new Promise(resolve=>access.close(resolve)),
    new Promise(resolve=>pay.close(resolve)),
  ]);
  await fs.rm(dataDir,{recursive:true,force:true});
}
