import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=await mkdtemp(path.join(os.tmpdir(),'izakhono-code-runner-test-'));
const port=20000+Math.floor(Math.random()*20000);
const token='test-runner-token-that-is-long-enough';
const tokenFile=path.join(root,'token');
await writeFile(tokenFile,token,{mode:0o600});
const child=spawn(process.execPath,[path.join(here,'server.mjs')],{
  env:{...process.env,PORT:String(port),IZAKHONO_CODE_WORKSPACE_ROOT:path.join(root,'workspaces'),IZAKHONO_CODE_RUNNER_TOKEN_FILE:tokenFile},
  stdio:'ignore',
});
const base='http://127.0.0.1:'+port;
try{
  let ready=false;
  for(let i=0;i<40;i++){
    try{const response=await fetch(base+'/healthz');if(response.ok){ready=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(ready,true,'runner health endpoint should become ready');
  const health=await fetch(base+'/healthz').then(r=>r.json());
  assert.equal(health.service,'IZAKHONO CODE isolated runner');
  const unauthorized=await fetch(base+'/v1/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({workspace_id:'00000000-0000-4000-8000-000000000000',action:'diff',input:{}})});
  assert.equal(unauthorized.status,401);
  const invalidWorkspace=await fetch(base+'/v1/execute',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({workspace_id:'not-a-workspace',action:'diff',input:{}})});
  assert.equal(invalidWorkspace.status,400);
  console.log('[PASS] IZAKHONO CODE runner health, authentication and workspace identity contract.');
}finally{
  child.kill('SIGTERM');
  await rm(root,{recursive:true,force:true});
}
