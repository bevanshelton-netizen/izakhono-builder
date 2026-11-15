import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const {Pool}=pg;
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000}):null;
let dbInit=null;
const PORT=Number(process.env.PORT||8082);
const DATA_DIR=process.env.DATA_DIR||'/data';
const STATE_FILE=path.join(DATA_DIR,'compute-state.json');
const ADMIN_TOKEN=process.env.COMPUTE_ADMIN_TOKEN||'';
const LEASE_MS=Math.max(15000,Number(process.env.COMPUTE_LEASE_MS||120000));
const MAX_BODY=256*1024;
const TYPES=new Set(['health-check','sha256','echo']);
let writeChain=Promise.resolve();
const id=p=>p+'_'+crypto.randomUUID().replaceAll('-','');
const now=()=>new Date().toISOString();
const fresh=()=>({version:1,nodes:[],jobs:[],audit:[]});
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
function same(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)}
async function ensureDb(){
 if(!pool)return;
 if(!dbInit)dbInit=(async()=>{await pool.query('CREATE TABLE IF NOT EXISTS izakhono_compute_state (id smallint PRIMARY KEY CHECK (id=1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');await pool.query('INSERT INTO izakhono_compute_state(id,payload) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(fresh())])})();
 await dbInit;
}
async function load(){
 if(pool){await ensureDb();const r=await pool.query('SELECT payload FROM izakhono_compute_state WHERE id=1');return r.rows[0]?.payload||fresh()}
 await fs.mkdir(DATA_DIR,{recursive:true});try{return JSON.parse(await fs.readFile(STATE_FILE,'utf8'))}catch(e){if(e.code==='ENOENT')return fresh();throw e}
}
async function save(s){
 if(pool){await ensureDb();await pool.query('UPDATE izakhono_compute_state SET payload=$1::jsonb,updated_at=now() WHERE id=1',[JSON.stringify(s)]);return}
 const tmp=STATE_FILE+'.tmp';await fs.writeFile(tmp,JSON.stringify(s,null,2),{mode:0o600});await fs.rename(tmp,STATE_FILE)
}
async function mutate(fn){
 if(pool){await ensureDb();const client=await pool.connect();try{await client.query('BEGIN');const r=await client.query('SELECT payload FROM izakhono_compute_state WHERE id=1 FOR UPDATE');const state=r.rows[0]?.payload||fresh();const out=await fn(state);await client.query('UPDATE izakhono_compute_state SET payload=$1::jsonb,updated_at=now() WHERE id=1',[JSON.stringify(state)]);await client.query('COMMIT');return out}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
 let release;const prior=writeChain;writeChain=new Promise(r=>release=r);await prior;try{const state=await load();const out=await fn(state);await save(state);return out}finally{release()}
}
function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
async function readBody(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Object.assign(new Error('Request too large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}}
function admin(req){return Boolean(ADMIN_TOKEN)&&req.headers.authorization===`Bearer ${ADMIN_TOKEN}`}
function audit(s,action,actor,details={}){s.audit.push({id:id('evt'),at:now(),action,actor,details});if(s.audit.length>5000)s.audit=s.audit.slice(-5000)}
function cleanCapabilities(value){return Array.isArray(value)?[...new Set(value.filter(x=>TYPES.has(x)))]:[]}
function expireLeases(s){const t=Date.now();for(const j of s.jobs){if(j.status==='leased'&&Date.parse(j.lease_expires_at)<=t){j.attempts++;j.status=j.attempts>=5?'failed':'queued';j.worker_id=null;j.lease_token=null;j.lease_expires_at=null;j.updated_at=now();if(j.status==='failed'){j.error='Maximum lease attempts exceeded';j.finished_at=now()}audit(s,'job.lease_expired','scheduler',{job_id:j.id,attempts:j.attempts,status:j.status})}}}
function workerAuthorized(s,workerId,token){const n=s.nodes.find(x=>x.id===workerId);return Boolean(n?.worker_token_hash&&same(n.worker_token_hash,hash(token)))}
function markStaleNodes(s){const t=Date.now();for(const n of s.nodes)if(n.status==='online'&&t-Date.parse(n.last_seen_at)>60000){n.status='offline';audit(s,'worker.offline','monitor',{worker_id:n.id})}}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='GET'&&u.pathname==='/health'){
   if(pool)await pool.query('SELECT 1');
   return send(res,200,{ok:true,service:'IZAKHONO Compute Manager',version:'1.1.0',persistence:pool?'postgresql':'local-test'});
  }
  if(u.pathname.startsWith('/worker/')){
   if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
   const b=await readBody(req);
   if(u.pathname==='/worker/register'){
    const workerId=String(b.worker_id||'');
    if(!/^[-a-zA-Z0-9_.]{3,80}$/.test(workerId)||typeof b.enrollment_token!=='string')return send(res,400,{ok:false,error:'Valid worker_id and enrollment_token are required'});
    const result=await mutate(s=>{
     const n=s.nodes.find(x=>x.id===workerId);
     if(!n||!n.enrollment_token_hash||Date.parse(n.enrollment_expires_at||0)<=Date.now()||!same(n.enrollment_token_hash,hash(b.enrollment_token)))return {error:'Invalid, expired or already-used enrollment token',status:401};
     const workerToken=crypto.randomBytes(48).toString('base64url');
     Object.assign(n,{status:'online',last_seen_at:now(),hostname:String(b.hostname||workerId).slice(0,120),capabilities:cleanCapabilities(b.capabilities),resources:{cpu_count:Math.max(1,Math.min(1024,Number(b.resources?.cpu_count)||1)),memory_mb:Math.max(128,Math.min(4194304,Number(b.resources?.memory_mb)||512))},worker_token_hash:hash(workerToken),enrollment_token_hash:null,enrollment_expires_at:null});
     audit(s,'worker.enrolled',workerId,{capabilities:n.capabilities});
     return {worker_token:workerToken,node:{id:n.id,status:n.status,capabilities:n.capabilities,resources:n.resources}};
    });
    return result.error?send(res,result.status,{ok:false,error:result.error}):send(res,200,{ok:true,...result});
   }
   const workerId=String(b.worker_id||'');
   const auth=await load();
   if(!workerAuthorized(auth,workerId,req.headers.authorization?.replace(/^Bearer\s+/i,'')||''))return send(res,401,{ok:false,error:'Worker identity authentication failed'});
   if(u.pathname==='/worker/claim'){
    const result=await mutate(s=>{expireLeases(s);const n=s.nodes.find(x=>x.id===workerId);if(!n)return {error:'Worker not found',status:404};n.last_seen_at=now();if(n.status!=='draining')n.status='online';if(n.status!=='online')return {job:null,node_status:n.status};const job=s.jobs.filter(j=>j.status==='queued'&&n.capabilities.includes(j.type)&&n.resources.cpu_count>=(j.requirements?.cpu_count||1)&&n.resources.memory_mb>=(j.requirements?.memory_mb||128)).sort((a,b)=>b.priority-a.priority||a.created_at.localeCompare(b.created_at))[0];if(!job)return {job:null,node_status:n.status};job.status='leased';job.worker_id=workerId;job.lease_token=crypto.randomBytes(24).toString('hex');job.lease_expires_at=new Date(Date.now()+LEASE_MS).toISOString();job.updated_at=now();audit(s,'job.leased',workerId,{job_id:job.id});return {job:{id:job.id,type:job.type,input:job.input,lease_token:job.lease_token,lease_expires_at:job.lease_expires_at},node_status:n.status}});
    return result.error?send(res,result.status,{ok:false,error:result.error}):send(res,200,{ok:true,...result});
   }
   if(u.pathname==='/worker/heartbeat'){
    const node=await mutate(s=>{const n=s.nodes.find(x=>x.id===workerId);if(!n)return null;n.last_seen_at=now();n.status='online';return true});
    return node?send(res,200,{ok:true}):send(res,404,{ok:false,error:'Worker not found'});
   }
   const m=u.pathname.match(/^\/worker\/jobs\/([a-zA-Z0-9_-]+)\/(complete|fail)$/);
   if(m){
    const result=await mutate(s=>{const j=s.jobs.find(x=>x.id===m[1]);if(!j)return {status:404,error:'Job not found'};if(j.status!=='leased'||j.worker_id!==workerId||!b.lease_token||b.lease_token!==j.lease_token)return {status:409,error:'Lease mismatch or expired'};j.status=m[2]==='complete'?'succeeded':'failed';j.result=m[2]==='complete'?(b.result??null):null;j.error=m[2]==='fail'?String(b.error||'Worker failed').slice(0,1000):null;j.updated_at=now();j.finished_at=now();j.lease_token=null;j.lease_expires_at=null;audit(s,'job.'+j.status,workerId,{job_id:j.id});return {job:{id:j.id,status:j.status}}});
    return result.error?send(res,result.status,{ok:false,error:result.error}):send(res,200,{ok:true,...result});
   }
   return send(res,404,{ok:false,error:'Not found'});
  }
  if(!admin(req))return send(res,401,{ok:false,error:'Administrator authentication required'});
  if(req.method==='POST'&&u.pathname==='/api/compute/nodes/enroll'){
   const b=await readBody(req),workerId=String(b.worker_id||'');
   if(!/^[-a-zA-Z0-9_.]{3,80}$/.test(workerId))return send(res,400,{ok:false,error:'Invalid worker_id'});
   const enrollmentToken=crypto.randomBytes(32).toString('base64url');
   const node=await mutate(s=>{let n=s.nodes.find(x=>x.id===workerId);if(!n){n={id:workerId,created_at:now()};s.nodes.push(n)}Object.assign(n,{status:'pending',enrollment_token_hash:hash(enrollmentToken),enrollment_expires_at:new Date(Date.now()+10*60*1000).toISOString(),worker_token_hash:null,last_seen_at:null});audit(s,'worker.enrollment_issued','administrator',{worker_id:workerId});return {id:n.id,status:n.status,expires_at:n.enrollment_expires_at}});
   return send(res,201,{ok:true,node,worker_id:workerId,enrollment_token:enrollmentToken});
  }
  const nodeAction=u.pathname.match(/^\\/api\\/compute\\/nodes\\/([a-zA-Z0-9_.-]+)\\/(drain|resume)$/);
  if(req.method==='POST'&&nodeAction){
   const workerId=nodeAction[1],action=nodeAction[2];
   const result=await mutate(s=>{const n=s.nodes.find(x=>x.id===workerId);if(!n)return null;if(action==='drain'){n.status='draining';n.drain_requested_at=now();audit(s,'worker.drained','administrator',{worker_id:workerId})}else{n.status=n.worker_token_hash&&Date.now()-Date.parse(n.last_seen_at||0)<60000?'online':'offline';n.drain_requested_at=null;audit(s,'worker.resumed','administrator',{worker_id:workerId,status:n.status})}return {id:n.id,status:n.status}});
   return result?send(res,200,{ok:true,node:result}):send(res,404,{ok:false,error:'Worker not found'});
  }
  const cancelJob=u.pathname.match(/^\\/api\\/compute\\/jobs\\/([a-zA-Z0-9_-]+)\\/cancel$/);
  if(req.method==='POST'&&cancelJob){
   const result=await mutate(s=>{const j=s.jobs.find(x=>x.id===cancelJob[1]);if(!j)return null;if(!['queued','leased'].includes(j.status))return {conflict:true,status:j.status};j.status='cancelled';j.lease_token=null;j.lease_expires_at=null;j.finished_at=now();j.updated_at=now();audit(s,'job.cancelled','administrator',{job_id:j.id});return {id:j.id,status:j.status}});
   if(!result)return send(res,404,{ok:false,error:'Job not found'});
   if(result.conflict)return send(res,409,{ok:false,error:'Job is already terminal',status:result.status});
   return send(res,200,{ok:true,job:result});
  }
  if(req.method==='GET'&&u.pathname==='/api/compute/summary'){
   const result=await mutate(s=>{expireLeases(s);markStaleNodes(s);const counts={};for(const j of s.jobs)counts[j.status]=(counts[j.status]||0)+1;const nodes=s.nodes;return {nodes:nodes.length,online_nodes:nodes.filter(n=>n.status==='online').length,jobs:counts,capacity:nodes.filter(n=>n.status==='online').reduce((a,n)=>({cpu_count:a.cpu_count+n.resources.cpu_count,memory_mb:a.memory_mb+n.resources.memory_mb}),{cpu_count:0,memory_mb:0})}});
   return send(res,200,{ok:true,...result});
  }
  if(req.method==='GET'&&u.pathname==='/api/compute/nodes'){const nodes=await mutate(s=>{markStaleNodes(s);return s.nodes.map(n=>({...n,worker_token_hash:undefined,enrollment_token_hash:undefined}))});return send(res,200,{ok:true,nodes})}
  if(req.method==='GET'&&u.pathname==='/api/compute/jobs'){const s=await load();return send(res,200,{ok:true,jobs:s.jobs.slice(-250).reverse()})}
  if(req.method==='GET'&&u.pathname==='/api/compute/audit'){const s=await load();return send(res,200,{ok:true,events:s.audit.slice(-250).reverse()})}
  if(req.method==='POST'&&u.pathname==='/api/compute/jobs'){
   const b=await readBody(req);if(!TYPES.has(b.type))return send(res,400,{ok:false,error:'Unsupported job type',allowed:[...TYPES]});const priority=Math.max(0,Math.min(100,Number(b.priority)||0));const input=b.input??{};if(Buffer.byteLength(JSON.stringify(input))>65536)return send(res,413,{ok:false,error:'Job input too large'});const requirements={cpu_count:Math.max(1,Math.min(1024,Number(b.requirements?.cpu_count)||1)),memory_mb:Math.max(128,Math.min(4194304,Number(b.requirements?.memory_mb)||128))};
   const job=await mutate(s=>{const queued=s.jobs.filter(j=>j.status==='queued'||j.status==='leased').length;if(queued>=1000)throw Object.assign(new Error('Compute queue capacity reached'),{status:429});const j={id:id('job'),type:b.type,input,requirements,status:'queued',priority,attempts:0,created_at:now(),updated_at:now(),worker_id:null,lease_token:null,lease_expires_at:null,result:null,error:null};s.jobs.push(j);audit(s,'job.queued','administrator',{job_id:j.id,type:j.type,priority});return j});
   return send(res,202,{ok:true,job:{id:job.id,type:job.type,status:job.status,created_at:job.created_at}});
  }
  const jm=u.pathname.match(/^\/api\/compute\/jobs\/([a-zA-Z0-9_-]+)$/);
  if(req.method==='GET'&&jm){const s=await load();const j=s.jobs.find(x=>x.id===jm[1]);return j?send(res,200,{ok:true,job:j}):send(res,404,{ok:false,error:'Job not found'})}
  return send(res,404,{ok:false,error:'Not found'});
 }catch(e){send(res,e.status||500,{ok:false,error:e.message||'Internal error'})}
});
await ensureDb();
server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO Compute Manager listening on ${PORT}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{if(pool)await pool.end();process.exit(0)}));
