import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||8082);
const DATA_DIR=process.env.DATA_DIR||'/data';
const STATE_FILE=path.join(DATA_DIR,'compute-state.json');
const ADMIN_TOKEN=process.env.COMPUTE_ADMIN_TOKEN||'';
const WORKER_TOKEN=process.env.COMPUTE_WORKER_TOKEN||'';
const LEASE_MS=Math.max(15_000,Number(process.env.COMPUTE_LEASE_MS||120_000));
const MAX_BODY=256*1024;
const TYPES=new Set(['health-check','sha256','echo']);
let writeChain=Promise.resolve();

const id=p=>p+'_'+crypto.randomUUID().replaceAll('-','');
const now=()=>new Date().toISOString();
const fresh=()=>({version:1,nodes:[],jobs:[],audit:[]});
async function load(){await fs.mkdir(DATA_DIR,{recursive:true});try{return JSON.parse(await fs.readFile(STATE_FILE,'utf8'))}catch(e){if(e.code==='ENOENT')return fresh();throw e}}
async function save(s){const tmp=STATE_FILE+'.tmp';await fs.writeFile(tmp,JSON.stringify(s,null,2),{mode:0o600});await fs.rename(tmp,STATE_FILE)}
async function mutate(fn){let release;const prior=writeChain;writeChain=new Promise(r=>release=r);await prior;try{const s=await load();const out=await fn(s);await save(s);return out}finally{release()}}
function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
async function readBody(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Object.assign(new Error('Request too large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}}
function token(req,expected){return Boolean(expected)&&req.headers.authorization===`Bearer ${expected}`}
function audit(s,action,actor,details={}){s.audit.push({id:id('evt'),at:now(),action,actor,details});if(s.audit.length>5000)s.audit=s.audit.slice(-5000)}
function cleanCapabilities(value){return Array.isArray(value)?[...new Set(value.filter(x=>TYPES.has(x)))]:[]}
function expireLeases(s){const t=Date.now();for(const j of s.jobs){if(j.status==='leased'&&Date.parse(j.lease_expires_at)<=t){j.status='queued';j.worker_id=null;j.lease_token=null;j.lease_expires_at=null;j.attempts++;j.updated_at=now();audit(s,'job.lease_expired','scheduler',{job_id:j.id,attempts:j.attempts})}}}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET'&&u.pathname==='/health')return send(res,200,{ok:true,service:'IZAKHONO Compute Manager',version:'1.0.0'});
    if(u.pathname.startsWith('/worker/')){
      if(!token(req,WORKER_TOKEN))return send(res,401,{ok:false,error:'Worker authentication required'});
      if(req.method==='POST'&&u.pathname==='/worker/register'){
        const b=await readBody(req);if(typeof b.worker_id!=='string'||!/^[-a-zA-Z0-9_.]{3,80}$/.test(b.worker_id))return send(res,400,{ok:false,error:'Invalid worker_id'});
        const node=await mutate(s=>{let n=s.nodes.find(x=>x.id===b.worker_id);if(!n){n={id:b.worker_id,created_at:now(),status:'online'};s.nodes.push(n)}Object.assign(n,{status:'online',last_seen_at:now(),hostname:String(b.hostname||b.worker_id).slice(0,120),capabilities:cleanCapabilities(b.capabilities),resources:{cpu_count:Math.max(1,Math.min(1024,Number(b.resources?.cpu_count)||1)),memory_mb:Math.max(128,Math.min(4_194_304,Number(b.resources?.memory_mb)||512))}});audit(s,'worker.register',n.id,{capabilities:n.capabilities});return n});
        return send(res,200,{ok:true,node});
      }
      if(req.method==='POST'&&u.pathname==='/worker/claim'){
        const b=await readBody(req);const worker=String(b.worker_id||'');
        const result=await mutate(s=>{expireLeases(s);const n=s.nodes.find(x=>x.id===worker&&x.status==='online');if(!n) return {error:'Worker not registered',status:409};n.last_seen_at=now();const job=s.jobs.filter(j=>j.status==='queued'&&n.capabilities.includes(j.type)).sort((a,b)=>b.priority-a.priority||a.created_at.localeCompare(b.created_at))[0];if(!job)return {job:null};job.status='leased';job.worker_id=worker;job.lease_token=crypto.randomBytes(24).toString('hex');job.lease_expires_at=new Date(Date.now()+LEASE_MS).toISOString();job.updated_at=now();audit(s,'job.leased',worker,{job_id:job.id});return {job:{id:job.id,type:job.type,input:job.input,lease_token:job.lease_token,lease_expires_at:job.lease_expires_at}}});
        return result.error?send(res,result.status,{ok:false,error:result.error}):send(res,200,{ok:true,...result});
      }
      if(req.method==='POST'&&u.pathname==='/worker/heartbeat'){
        const b=await readBody(req);const node=await mutate(s=>{const n=s.nodes.find(x=>x.id===b.worker_id);if(!n)return null;n.last_seen_at=now();n.status='online';return n});return node?send(res,200,{ok:true}):send(res,404,{ok:false,error:'Worker not found'});
      }
      const m=u.pathname.match(/^\/worker\/jobs\/([a-zA-Z0-9_-]+)\/(complete|fail)$/);
      if(req.method==='POST'&&m){
        const b=await readBody(req);const result=await mutate(s=>{const j=s.jobs.find(x=>x.id===m[1]);if(!j)return {status:404,error:'Job not found'};if(j.status!=='leased'||j.worker_id!==b.worker_id||!b.lease_token||b.lease_token!==j.lease_token)return {status:409,error:'Lease mismatch or expired'};j.status=m[2]==='complete'?'succeeded':'failed';j.result=m[2]==='complete'?(b.result??null):null;j.error=m[2]==='fail'?String(b.error||'Worker failed').slice(0,1000):null;j.updated_at=now();j.finished_at=now();j.lease_token=null;j.lease_expires_at=null;audit(s,'job.'+j.status,String(b.worker_id),{job_id:j.id});return {job:{id:j.id,status:j.status}}});return result.error?send(res,result.status,{ok:false,error:result.error}):send(res,200,{ok:true,...result});
      }
      return send(res,404,{ok:false,error:'Not found'});
    }
    if(!token(req,ADMIN_TOKEN))return send(res,401,{ok:false,error:'Administrator authentication required'});
    if(req.method==='GET'&&u.pathname==='/api/compute/summary'){
      const s=await load();expireLeases(s);const counts={};for(const j of s.jobs)counts[j.status]=(counts[j.status]||0)+1;return send(res,200,{ok:true,nodes:s.nodes.length,online_nodes:s.nodes.filter(n=>n.status==='online'&&Date.now()-Date.parse(n.last_seen_at)<60_000).length,jobs:counts,capacity:s.nodes.filter(n=>n.status==='online').reduce((a,n)=>({cpu_count:a.cpu_count+n.resources.cpu_count,memory_mb:a.memory_mb+n.resources.memory_mb}),{cpu_count:0,memory_mb:0})});
    }
    if(req.method==='GET'&&u.pathname==='/api/compute/nodes'){const s=await load();return send(res,200,{ok:true,nodes:s.nodes})}
    if(req.method==='GET'&&u.pathname==='/api/compute/jobs'){const s=await load();return send(res,200,{ok:true,jobs:s.jobs.slice(-250).reverse()})}
    if(req.method==='GET'&&u.pathname==='/api/compute/audit'){const s=await load();return send(res,200,{ok:true,events:s.audit.slice(-250).reverse()})}
    if(req.method==='POST'&&u.pathname==='/api/compute/jobs'){
      const b=await readBody(req);if(!TYPES.has(b.type))return send(res,400,{ok:false,error:'Unsupported job type',allowed:[...TYPES]});
      const priority=Math.max(0,Math.min(100,Number(b.priority)||0));
      const input=b.input??{};if(Buffer.byteLength(JSON.stringify(input))>64*1024)return send(res,413,{ok:false,error:'Job input too large'});
      const job=await mutate(s=>{const queued=s.jobs.filter(j=>j.status==='queued'||j.status==='leased').length;if(queued>=1000)throw Object.assign(new Error('Compute queue capacity reached'),{status:429});const j={id:id('job'),type:b.type,input,status:'queued',priority,attempts:0,created_at:now(),updated_at:now(),worker_id:null,lease_token:null,lease_expires_at:null,result:null,error:null};s.jobs.push(j);audit(s,'job.queued','administrator',{job_id:j.id,type:j.type,priority});return j});
      return send(res,202,{ok:true,job:{id:job.id,type:job.type,status:job.status,created_at:job.created_at}});
    }
    const jm=u.pathname.match(/^\/api\/compute\/jobs\/([a-zA-Z0-9_-]+)$/);
    if(req.method==='GET'&&jm){const s=await load();const j=s.jobs.find(x=>x.id===jm[1]);return j?send(res,200,{ok:true,job:j}):send(res,404,{ok:false,error:'Job not found'})}
    return send(res,404,{ok:false,error:'Not found'});
  }catch(e){send(res,e.status||500,{ok:false,error:e.message||'Internal error'})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO Compute Manager listening on ${PORT}`));
