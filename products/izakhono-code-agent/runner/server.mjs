import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const PORT=Number(process.env.PORT||8860);
const TOKEN_FILE=process.env.IZAKHONO_CODE_RUNNER_TOKEN_FILE||'/run/secrets/izakhono-code-runner-token';
const ROOT=path.resolve(process.env.IZAKHONO_CODE_WORKSPACE_ROOT||'/var/lib/izakhono-code/workspaces');
const MAX_BODY=22*1024*1024;
const MAX_OUTPUT=2_000_000;
const COMMANDS=new Set(['node','npm','npx']);
const workspaces=new Map();
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
async function token(){try{return (await fs.readFile(TOKEN_FILE,'utf8')).trim()}catch{return process.env.IZAKHONO_CODE_RUNNER_TOKEN||''}}
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)}
async function readBody(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>MAX_BODY)throw new Error('Request too large');chunks.push(c)}return Buffer.concat(chunks)}
function safePath(input){if(typeof input!=='string'||!input.trim())throw new Error('Path required');const p=input.replaceAll('\\','/');if(p.startsWith('/')||/^[A-Za-z]:/.test(p)||p.includes('\\0'))throw new Error('Absolute path rejected');const parts=p.split('/');if(parts.some(x=>!x||x==='.'||x==='..'))throw new Error('Unsafe path');return parts.join('/')}
function rootOf(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Invalid workspace id');return path.join(ROOT,id)}
async function ensureInside(root,file){const resolved=path.resolve(root,file);if(resolved!==root&&!resolved.startsWith(root+path.sep))throw new Error('Path escapes workspace');let current=root;for(const part of path.relative(root,resolved).split(path.sep).filter(Boolean)){current=path.join(current,part);try{const stat=await fs.lstat(current);if(stat.isSymbolicLink())throw new Error('Symbolic links are not permitted in workspaces')}catch(error){if(error.code==='ENOENT')break;throw error}}return resolved}
async function exec(command,args,options={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','pipe','pipe'],...options});let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.length>MAX_OUTPUT)child.kill('SIGKILL')});child.stderr.on('data',b=>{stderr+=b.toString();if(stderr.length>MAX_OUTPUT)child.kill('SIGKILL')});const timer=setTimeout(()=>child.kill('SIGKILL'),options.timeout||30000);child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('close',code=>{clearTimeout(timer);resolve({exit_code:code??-1,stdout:stdout.slice(0,MAX_OUTPUT),stderr:stderr.slice(0,MAX_OUTPUT)})})})}
function sensitiveName(name){
  const base=path.basename(name).toLowerCase();
  if(['.npmrc','.pypirc','.netrc','credentials.json','service-account.json','id_rsa','id_ed25519'].includes(base))return true;
  if(base==='.env'||(base.startsWith('.env.')&&!['.env.example','.env.sample','.env.template'].includes(base)))return true;
  if(['.ssh','.aws','.gnupg'].includes(base))return true;
  return /\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(base);
}
async function stripSensitiveFiles(root,dir=root){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const target=path.join(dir,entry.name);
    if(sensitiveName(entry.name)){await fs.rm(target,{recursive:true,force:true});continue;}
    if(entry.isDirectory())await stripSensitiveFiles(root,target);
    else if(entry.isSymbolicLink())throw new Error('Workspace symlinks are not permitted');
  }
}
function redactSecrets(value){
  return String(value)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]')
    .replace(/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})\b/g,'[REDACTED TOKEN]')
    .replace(/((?:api[_-]?key|client[_-]?secret|access[_-]?token|password|passwd|secret)\s*[:=]\s*["'])[^"']{8,}(["'])/gi,'$1[REDACTED]$2');
}
async function extractArchive(dir,archive){
  const tmp=path.join(os.tmpdir(),'izakhono-'+crypto.randomUUID()+'.tgz');
  await fs.writeFile(tmp,archive,{mode:0o600});
  try{
    const verbose=await exec('tar',['-tvzf',tmp],{timeout:15000});
    if(verbose.exit_code!==0)throw new Error('Invalid repository archive');
    const entries=verbose.stdout.split('\n').filter(Boolean);
    if(entries.length>20000)throw new Error('Repository has too many files');
    if(verbose.stdout.length>=MAX_OUTPUT)throw new Error('Archive listing exceeds safety limit');
    for(const line of entries){if(line[0]!=='d'&&line[0]!=='-')throw new Error('Archive special files and links are not permitted');}
    const listing=await exec('tar',['-tzf',tmp],{timeout:15000});
    if(listing.exit_code!==0||listing.stdout.length>=MAX_OUTPUT)throw new Error('Invalid or oversized repository archive listing');
    for(const name of listing.stdout.split('\n').filter(Boolean)){
      const normalized=name.replaceAll('\\','/');
      if(normalized.startsWith('/')||normalized.split('/').includes('..'))throw new Error('Archive contains an unsafe path');
    }
    const extracted=await exec('tar',['--no-same-owner','--no-same-permissions','-xzf',tmp,'-C',dir,'--strip-components=1'],{timeout:30000});
    if(extracted.exit_code!==0)throw new Error('Repository archive extraction failed');
  }finally{await fs.rm(tmp,{force:true})}
}
async function installDependencies(root){
  const lockPath=await ensureInside(root,'package-lock.json');
  const raw=await fs.readFile(lockPath,'utf8');
  if(raw.length>5_000_000)throw new Error('package-lock.json exceeds 5 MB');
  const lock=JSON.parse(raw);
  if(!lock||typeof lock!=='object'||!lock.packages)throw new Error('A modern package-lock.json is required');
  for(const entry of Object.values(lock.packages)){
    const resolved=entry&&typeof entry==='object'?entry.resolved:undefined;
    if(!resolved||String(resolved).startsWith('file:'))continue;
    let url;try{url=new URL(String(resolved))}catch{throw new Error('Lockfile contains an invalid package URL')}
    if(url.protocol!=='https:'||url.hostname!=='registry.npmjs.org'||url.port||url.username||url.password||url.search||url.hash)throw new Error('Dependency lockfile contains a package outside registry.npmjs.org');
  }
  const args=['run','--rm','--network','bridge','--memory=1g','--cpus=2','--pids-limit=128','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=256m','--cap-drop=ALL','--security-opt=no-new-privileges','--user','10001:10001','--env','HOME=/tmp','--env','npm_config_cache=/tmp/npm-cache','--mount','type=bind,src='+root+',dst=/workspace,rw','-w','/workspace','node:22-bookworm-slim','npm','ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org'];
  return exec('docker',args,{timeout:180000});
}
async function runSandbox(root,argv,timeout){if(!Array.isArray(argv)||!argv.length||argv.length>12||argv.some(x=>typeof x!=='string'||x.length>500))throw new Error('Invalid argv');if(!COMMANDS.has(argv[0]))throw new Error('Executable is not allowlisted');if(argv.some(x=>['-c','--eval','--require','-e','-r','--import','--inspect','--inspect-brk'].includes(x)))throw new Error('Interpreter/eval/debug flags are forbidden');if(argv[0]==='npm'){const allowed=argv[1]==='test'||(argv[1]==='run'&&['test','typecheck','lint','build','check'].includes(argv[2]));if(!allowed)throw new Error('Only test, typecheck, lint, build and check npm scripts are permitted');}if(argv[0]==='npx'&&argv[1]!=='--no-install')throw new Error('npx must use --no-install; network package execution is disabled');if(argv[0]==='node'&&argv[1]?.startsWith('-'))throw new Error('Node runtime flags are not permitted');const args=['run','--rm','--network','none','--memory=1g','--cpus=2','--pids-limit=128','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','--cap-drop=ALL','--security-opt=no-new-privileges','--user','10001:10001','--env','HOME=/tmp','--env','npm_config_cache=/tmp/npm-cache','--mount','type=bind,src='+root+',dst=/workspace,rw','-w','/workspace','node:22-bookworm-slim',...argv];return exec('docker',args,{timeout:Math.min(Math.max(timeout||30000,1000),120000)})}
async function handler(req,res){const url=new URL(req.url||'/','http://localhost');if(req.method==='GET'&&url.pathname==='/healthz')return send(res,200,{ok:true,service:'IZAKHONO CODE isolated runner',version:'1.0.0',docker:true});const expected=await token();if(expected.length<32)return send(res,503,{ok:false,error:'Runner owner token is not configured securely'});if(!equal(req.headers.authorization?.replace(/^Bearer\s+/i,''),expected))return send(res,401,{ok:false,error:'Unauthorized'});try{
if(req.method==='POST'&&url.pathname==='/v1/workspaces'){const repo=String(req.headers['x-repository']||'');const ref=String(req.headers['x-base-ref']||'main');if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))return send(res,400,{ok:false,error:'Invalid repository'});const archive=await readBody(req);const id=crypto.randomUUID();const root=rootOf(id);await fs.mkdir(root,{recursive:true,mode:0o777});await extractArchive(root,archive);await stripSensitiveFiles(root);await fs.writeFile(path.join(root,'.izakhono-workspace.json'),JSON.stringify({repository:repo,base_ref:ref,created_at:new Date().toISOString()}));await exec('git',['init','-q'],{cwd:root});await exec('git',['add','-A'],{cwd:root});await exec('git',['-c','user.name=IZAKHONO CODE','-c','user.email=code@izakhono.local','commit','-qm','Workspace baseline'],{cwd:root});workspaces.set(id,{repository:repo,base_ref:ref});return send(res,201,{ok:true,workspace_id:id})}
if(req.method==='POST'&&url.pathname==='/v1/execute'){const body=JSON.parse((await readBody(req)).toString('utf8'));const id=String(body.workspace_id||'');const root=rootOf(id);await fs.access(root);if(!workspaces.has(id)){const meta=JSON.parse(await fs.readFile(path.join(root,'.izakhono-workspace.json'),'utf8'));workspaces.set(id,meta)}const action=body.action,input=body.input||{};
if(action==='list_files'){const raw=String(input.path||'src');const rel=raw==='.'?'':safePath(raw);const target=await ensureInside(root,rel);const entries=await fs.readdir(target,{withFileTypes:true});return send(res,200,{ok:true,files:entries.map(e=>({name:e.name,type:e.isDirectory()?'directory':'file'}))})}
if(action==='read_file'){const rel=safePath(input.path);if(sensitiveName(rel))return send(res,403,{ok:false,error:'Sensitive files are not available to the coding agent'});const target=await ensureInside(root,rel);const stat=await fs.stat(target);if(!stat.isFile()||stat.size>1000000)return send(res,413,{ok:false,error:'File missing, not regular, or exceeds 1 MB'});const bytes=await fs.readFile(target);let content;try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return send(res,415,{ok:false,error:'Binary or non-UTF-8 files cannot be read or published'})}const safe=redactSecrets(content);return send(res,200,{ok:true,path:rel,content:safe,secret_detected:safe!==content})}
if(action==='apply_patch'){const rel=safePath(input.path);if(sensitiveName(rel))throw new Error('Sensitive files cannot be edited');await ensureInside(root,rel);const patch=String(input.patch||'');if(!patch||patch.length>100000)throw new Error('Patch exceeds policy');if(/120000|160000|GIT binary patch/.test(patch))throw new Error('Symlink and submodule patches are not permitted');const temp=path.join(os.tmpdir(),'izakhono-patch-'+crypto.randomUUID()+'.diff');await fs.writeFile(temp,patch);try{const result=await exec('git',['apply','--whitespace=error',temp],{cwd:root,timeout:10000});if(result.exit_code!==0)throw new Error('Patch rejected: '+result.stderr.slice(0,1000))}finally{await fs.rm(temp,{force:true})}return send(res,200,{ok:true,path:rel,applied:true})}
if(action==='install_dependencies'){const result=await installDependencies(root);return send(res,result.exit_code===0?200:409,{ok:result.exit_code===0,...result})}
if(action==='run_command'){const result=await runSandbox(root,input.argv,input.timeout_ms);return send(res,200,{ok:true,...result,stdout:redactSecrets(result.stdout),stderr:redactSecrets(result.stderr)})}
if(action==='diff'){const result=await exec('git',['diff','--no-ext-diff','--'],{cwd:root,timeout:10000});const names=await exec('git',['status','--short'],{cwd:root,timeout:10000});return send(res,200,{ok:true,diff:result.stdout,status:names.stdout})}
if(action==='changed_files'){const tracked=await exec('git',['diff','--name-only','HEAD'],{cwd:root,timeout:10000});const untracked=await exec('git',['ls-files','--others','--exclude-standard'],{cwd:root,timeout:10000});const paths=[...new Set([...tracked.stdout.split('\n'),...untracked.stdout.split('\n')].filter(Boolean))];if(paths.length>200)throw new Error('Too many changed files for one pull request');const files=[];for(const value of paths){const rel=safePath(value);if(sensitiveName(rel))throw new Error('Sensitive files cannot be published');const target=await ensureInside(root,rel);try{const stat=await fs.lstat(target);if(stat.isSymbolicLink()||!stat.isFile())throw new Error('Only regular files may be published');files.push({path:rel,deleted:false})}catch(error){if(error.code==='ENOENT')files.push({path:rel,deleted:true});else throw error}}return send(res,200,{ok:true,files})}
return send(res,400,{ok:false,error:'Unsupported action'});
}catch(error){return send(res,400,{ok:false,error:error instanceof Error?error.message:'Runner error'})}}
await fs.mkdir(ROOT,{recursive:true});
http.createServer((req,res)=>{handler(req,res).catch(e=>send(res,500,{ok:false,error:e.message}))}).listen(PORT,process.env.IZAKHONO_CODE_RUNNER_BIND_HOST||'0.0.0.0',()=>process.stdout.write('[IZAKHONO CODE] runner listening on '+(process.env.IZAKHONO_CODE_RUNNER_BIND_HOST||'0.0.0.0')+':'+PORT+'\n'));
