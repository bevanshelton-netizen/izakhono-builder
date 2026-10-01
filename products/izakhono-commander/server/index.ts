import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readdir,stat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
const execFileAsync=promisify(execFile);
const port=Number(process.env.COMMANDER_PORT||8787);
const admin=process.env.COMMANDER_ADMIN_SECRET;
if(!admin||admin.length<24) throw new Error('COMMANDER_ADMIN_SECRET must be at least 24 characters');
type Device={id:string,name:string,platform:string,status:string,agentTokenHash:string,enrolledAt:string,lastSeenAt:string,createdAt:string};
const devices=new Map<string,Device>();
const pairings=new Map<string,{deviceId:string,expires:number,used:boolean}>();
const audit:Record<string,unknown>[]=[];
const hash=(x:string)=>createHash('sha256').update(x).digest('hex');
const now=()=>new Date().toISOString();
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const ok=(r:Request)=>r.headers.get('x-commander-admin')===admin;
const log=(actor:string,action:string,target:string,outcome:string,detail='')=>audit.push({actor,action,target,outcome,detail,createdAt:now()});
function token(r:Request,d:Device){const t=r.headers.get('authorization')?.replace(/^Bearer /i,'');return !!t&&hash(t)===d.agentTokenHash}
async function body(r:Request){try{return await r.json()}catch{return {}}}
function route(path:string){return path.replace(/\\/+$/,'')||'/'}
const commandMap:Record<string,{file:string,args:string[]}>= {hostname:{file:process.platform==='win32'?'hostname':'hostname',args:[]},node_version:{file:process.execPath,args:['--version']},platform:{file:process.platform==='win32'?'powershell':'uname',args:process.platform==='win32'?['-NoProfile','-Command','$PSVersionTable.Platform']:['-a']}};
async function main(){
 const server=Bun.serve({port,async fetch(r){
  const u=new URL(r.url),p=route(u.pathname);
  if(p==='/api/health')return json({ok:true,service:'izakhono-commander',version:'0.1.0',time:now()});
  if(p.startsWith('/api/')&&!ok(r)&&!p.startsWith('/api/agent/'))return json({error:'unauthorized'},401);
  if(p==='/api/devices'&&r.method==='GET')return json([...devices.values()].map(d=>({...d,agentTokenHash:undefined})));
  if(p==='/api/pairings'&&r.method==='POST'){
   const deviceId='dev_'+randomUUID();const code=randomBytes(4).toString('hex').toUpperCase();pairings.set(hash(code),{deviceId,expires:Date.now()+10*60*1000,used:false});
   log('operator','pair.create',deviceId,'ok');return json({deviceId,pairingCode:code,expiresInSeconds:600});
  }
  if(p==='/api/audit'&&r.method==='GET')return json(audit.slice(-200).reverse());
  if(p==='/api/agent/enroll'&&r.method==='POST'){
   const b=await body(r), key=hash(String(b.pairingCode||'')), pair=pairings.get(key);
   if(!pair||pair.used||pair.expires<Date.now())return json({error:'invalid_or_expired_pairing'},403);
   pair.used=true;const agentToken=randomBytes(32).toString('hex');const d:Device={id:pair.deviceId,name:String(b.name||pair.deviceId),platform:String(b.platform||'unknown'),status:'online',agentTokenHash:hash(agentToken),enrolledAt:now(),lastSeenAt:now(),createdAt:now()};devices.set(d.id,d);log(d.id,'agent.enroll',d.id,'ok');return json({deviceId:d.id,agentToken});
  }
  if(p==='/api/agent/heartbeat'&&r.method==='POST'){
   const b=await body(r),d=devices.get(String(b.deviceId));if(!d||!token(r,d))return json({error:'unauthorized'},401);d.lastSeenAt=now();d.status='online';return json({ok:true,time:d.lastSeenAt});
  }
  if(p==='/api/agent/command'&&r.method==='POST'){
   const b=await body(r),d=devices.get(String(b.deviceId));if(!d||!token(r,d))return json({error:'unauthorized'},401);const spec=commandMap[String(b.command)];if(!spec)return json({error:'command_not_allowed'},403);
   try{const out=await execFileAsync(spec.file,spec.args,{timeout:10000,maxBuffer:1024*1024});log(d.id,'command',String(b.command),'ok');return json({ok:true,stdout:out.stdout,stderr:out.stderr});}catch(e){log(d.id,'command',String(b.command),'error',String(e));return json({error:'command_failed'},500)}
  }
  if(p==='/api/files'&&r.method==='GET')return json({error:'filesystem inspection is agent-scoped in v0.1; use a paired agent endpoint'},501);
  if(p==='/')return new Response(await dashboard(),{headers:{'content-type':'text/html'}});
  return json({error:'not_found'},404);
 }});
 console.log('IZAKHONO COMMANDER listening on '+server.url);
}
async function dashboard(){return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO COMMANDER</title><style>body{font:16px system-ui;background:#07130f;color:#edf7f1;max-width:1000px;margin:auto;padding:28px}.card{background:#10231b;border:1px solid #214334;border-radius:14px;padding:18px;margin:12px 0}button,input{padding:10px;border-radius:8px;margin:4px}pre{white-space:pre-wrap}</style></head><body><h1>IZAKHONO COMMANDER</h1><p>Owned-first remote control plane</p><div class="card"><input id="s" type="password" placeholder="Admin secret"><button onclick="unlock()">Unlock</button></div><div class="card"><button onclick="pair()">Generate pairing code</button><pre id="p">-</pre></div><div class="card"><button onclick="load()">Refresh devices</button><pre id="d">-</pre></div><script>let s=sessionStorage.getItem("cs")||"";async function api(p,o={}){o.headers={...(o.headers||{}),"x-commander-admin":s};let r=await fetch(p,o),x=await r.json();if(!r.ok)throw Error(x.error);return x}function unlock(){s=document.getElementById("s").value;sessionStorage.setItem("cs",s);load()}async function pair(){document.getElementById("p").textContent=JSON.stringify(await api("/api/pairings",{method:"POST"}),null,2)}async function load(){document.getElementById("d").textContent=JSON.stringify(await api("/api/devices"),null,2)}</script></body></html>'}
main();
