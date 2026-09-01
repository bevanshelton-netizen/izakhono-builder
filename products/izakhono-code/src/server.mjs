import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Store, safeSlug } from './store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const productRoot = path.resolve(here, '..');
const dataRoot = path.resolve(process.env.IZAKHONO_CODE_DATA || path.join(productRoot, 'data'));
const reposRoot = path.join(dataRoot, 'repositories');
const packagesRoot = path.join(dataRoot, 'packages');
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '127.0.0.1';
const ownerToken = process.env.IZAKHONO_CODE_OWNER_TOKEN || '';
const store = await new Store(dataRoot).init();
await Promise.all([mkdir(reposRoot, { recursive: true }), mkdir(packagesRoot, { recursive: true })]);

const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
const body = async req => { let raw=''; for await (const part of req) { raw += part; if (raw.length > 2_000_000) throw new Error('Request too large.'); } return raw ? JSON.parse(raw) : {}; };
const auth = req => {
  if (!ownerToken) return true;
  const provided = Buffer.from(String(req.headers['x-izakhono-owner-token'] || ''));
  const expected = Buffer.from(ownerToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};
const run = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, shell: false, windowsHide: true }); let out=''; let err='';
  child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error((err || out || `${command} failed`).trim())));
});
const repoPath = slug => path.join(reposRoot, `${safeSlug(slug)}.git`);
const now = () => new Date().toISOString();

async function createRepository(input) {
  const slug = safeSlug(input.name); const bare = repoPath(slug);
  await run('git', ['init', '--bare', '--initial-branch=main', bare], productRoot);
  const repo = { id: randomUUID(), name: input.name, slug, description: input.description || '', visibility: input.visibility === 'public' ? 'public' : 'private', createdAt: now(), cloneUrl: `file:///${bare.replaceAll('\\','/')}` };
  await store.mutate(s => s.repositories.push(repo)); return repo;
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') return json(res, 200, { status:'ok', product:'IZAKHONO CODE', channel:'Complete Alpha', storage:dataRoot });
  if (url.pathname.startsWith('/api/') && !auth(req)) return json(res, 401, { error:'Owner authentication required.' });
  if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, await store.load());
  if (url.pathname === '/api/repositories' && req.method === 'POST') return json(res, 201, await createRepository(await body(req)));

  const fileMatch = url.pathname.match(/^\/api\/repositories\/([^/]+)\/file$/);
  if (fileMatch && req.method === 'GET') {
    const target = safeSlug(fileMatch[1]); const ref = url.searchParams.get('ref') || 'main'; const file = url.searchParams.get('path') || 'README.md';
    if (file.includes('..') || path.isAbsolute(file)) throw new Error('Invalid file path.');
    return json(res, 200, { content: await run('git', [`--git-dir=${repoPath(target)}`, 'show', `${ref}:${file}`], productRoot) });
  }
  if (fileMatch && req.method === 'PUT') {
    const target = safeSlug(fileMatch[1]); const input = await body(req); const file = String(input.path || 'README.md');
    if (file.includes('..') || path.isAbsolute(file)) throw new Error('Invalid file path.');
    const work = path.join(dataRoot, 'work', randomUUID()); await mkdir(path.dirname(path.join(work, file)), { recursive:true });
    await run('git', ['clone', repoPath(target), work], productRoot); await writeFile(path.join(work, file), String(input.content || ''));
    await run('git', ['add', file], work); await run('git', ['-c','user.name=IZAKHONO CODE','-c','user.email=code@izakhono.local','commit','-m',String(input.message || `Update ${file}`)], work); await run('git', ['push','origin','HEAD:main'], work);
    return json(res, 200, { status:'committed' });
  }

  const resource = url.pathname.match(/^\/api\/(issues|pull-requests|runs|releases)$/);
  if (resource && req.method === 'POST') {
    const input = await body(req); const map = { issues:'issues', 'pull-requests':'pullRequests', runs:'runs', releases:'releases' }; const key=map[resource[1]];
    const item = { id:randomUUID(), number:0, status:key==='runs'?'queued':'open', createdAt:now(), ...input };
    await store.mutate(s => { item.number=s[key].length+1; s[key].push(item); }); return json(res, 201, item);
  }
  if (url.pathname === '/api/runs/execute' && req.method === 'POST') {
    const input=await body(req); const allowed = new Set(['npm test','npm run build','python -m pytest -q']); if(!allowed.has(input.command)) throw new Error('Command is not in the reviewed Alpha allow-list.');
    const id=randomUUID(); const entry={id,number:0,repository:safeSlug(input.repository),command:input.command,status:'running',createdAt:now()}; await store.mutate(s=>{entry.number=s.runs.length+1;s.runs.push(entry)});
    const work=path.join(dataRoot,'runs',id); try { await run('git',['clone',repoPath(entry.repository),work],productRoot); entry.log=await run(process.platform==='win32'?'cmd':'sh',process.platform==='win32'?['/d','/s','/c',entry.command]:['-lc',entry.command],work); entry.status='passed'; } catch(e){entry.log=e.message;entry.status='failed';}
    entry.completedAt=now(); await store.mutate(s=>Object.assign(s.runs.find(x=>x.id===id),entry)); return json(res,200,entry);
  }

  if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, {'content-type':'text/html; charset=utf-8'}); return createReadStream(path.join(productRoot,'public','index.html')).pipe(res); }
  json(res,404,{error:'Not found'});
}

http.createServer((req,res)=>route(req,res).catch(error=>json(res,400,{error:error.message}))).listen(port,host,()=>console.log(`IZAKHONO CODE listening on http://${host}:${port}`));
