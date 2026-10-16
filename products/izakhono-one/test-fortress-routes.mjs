import http from 'node:http';
import { spawn } from 'node:child_process';

const port = 8901;
const child = spawn(process.execPath, ['server.mjs'], { env:{...process.env, PORT:String(port)}, stdio:['ignore','pipe','pipe'] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, options={}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();
  return {status:response.status, body};
}

try {
  await wait(250);
  const descriptor = await request('/api/fortress');
  if (descriptor.status !== 200 || descriptor.body.gate !== 'FORTRESS' || descriptor.body.roles.length !== 5) throw new Error('FORTRESS descriptor route failed');

  const denied = await request('/api/fortress/authorize', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({service:'nav',action:'navigation'})});
  if (denied.status !== 403 || denied.body.decision !== 'deny') throw new Error('FORTRESS deny route failed');

  const review = await request('/api/fortress/authorize', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({service:'commerce',action:'payments',principal:{id:'operator-1',role:'operator',authenticated:true,verified:false},payment:true})});
  if (review.status !== 202 || review.body.decision !== 'review') throw new Error('FORTRESS review route failed');

  const allowed = await request('/api/fortress/authorize', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({service:'nav',action:'navigation',principal:{id:'operator-1',role:'operator',authenticated:true,verified:true}})});
  if (allowed.status !== 200 || allowed.body.decision !== 'allow' || allowed.body.ok !== true) throw new Error('FORTRESS allow route failed');

  console.log('IZAKHONO ONE FORTRESS route test: PASS');
} finally {
  child.kill('SIGTERM');
}
