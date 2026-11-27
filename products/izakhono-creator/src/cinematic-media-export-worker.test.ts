import assert from 'node:assert/strict';
import { executeProductionDistributionExport, persistProductionExportResult } from './cinematic-media-export-worker';
import type { CinematicProduction } from './cinematic-production-graph';
import type { MediaExportRuntime } from './media-export-executor';

async function run() {

function box(type: string, payload: number[] = []): number[] {
  const size = payload.length + 8;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type).map(char => char.charCodeAt(0)), ...payload];
}
const mp4 = new Uint8Array([...box('ftyp'), ...box('moov', [1,2,3,4]), ...box('mdat', [5,6,7,8])]);
const source = new Uint8Array([1,2,3,4]);
const hash = 'a'.repeat(64);
const probe = JSON.stringify({ streams: [
  { codec_type:'video', codec_name:'h264', width:1080, height:1920, pix_fmt:'yuv420p', avg_frame_rate:'30/1' },
  { codec_type:'audio', codec_name:'aac', sample_rate:'48000', channels:2 },
], format:{ format_name:'mov,mp4,m4a,3gp,3g2,mj2', duration:'10' } });
let output = mp4;
let storeCount = 0;
const runtime: MediaExportRuntime = {
  async run(command) { return { stdout: command === 'ffprobe' ? probe : '', stderr:'' }; },
  async readFile(path) { return path === '/worker/master.mp4' ? source : output; },
  async writeFile() {},
  async sha256(bytes) { return bytes === source ? hash : 'b'.repeat(64); },
};
const project: CinematicProduction = {
  schema:'izakhono.cinematic/production-v1', id:'film-1', title:'Test Film', brief:'Test', status:'planned', format:'film', publicLive:false,
  characters:[], locations:[], props:[], scenes:[], shots:[], references:[],
  assets:[{ id:'master-1', kind:'video', status:'completed', source:'assembled', role:'master', storageKey:'masters/master-1.mp4', contentHash:hash, parentAssetIds:[], provenance:{createdAt:'2026-11-26T00:00:00.000Z', licence:'Original owned footage', consentRecordIds:[]} }],
  tasks:[{id:'export-task',kind:'export',status:'ready',dependsOnTaskIds:[],inputAssetIds:['master-1'],outputAssetIds:[],attempts:0}],
  approvals:[{id:'master-approval',gate:'master',status:'approved',approverId:'producer-1',decidedAt:'2026-11-26T08:00:00.000Z'}],
  metadata:{createdAt:'2026-11-26T00:00:00.000Z',updatedAt:'2026-11-26T00:00:00.000Z',ownerId:'owner-1',tags:[],version:1},
};
const store={async put(key:string,bytes:Uint8Array,metadata:{contentType:string;sha256:string}){storeCount++;assert.equal(key,'projects/film-1/exports/facebook.mp4');assert.equal(bytes.byteLength,mp4.byteLength);assert.equal(metadata.contentType,'video/mp4');}};
const request={masterAssetId:'master-1',exportTaskId:'export-task',outputAssetId:'distribution-1',outputPath:'/worker/distribution.mp4',objectKey:'projects/film-1/exports/facebook.mp4',recordedBy:'worker-node-01'};
const resolve=async(key:string)=>{assert.equal(key,'masters/master-1.mp4');return '/worker/master.mp4';};
const passed=await executeProductionDistributionExport(project,request,runtime,store,resolve,()=> '2026-11-26T09:00:00.000Z');
assert.equal(passed.export.status,'qa_passed');
assert.equal(storeCount,1);
assert.equal(passed.asset.status,'completed');
assert.equal(passed.production.tasks[0].status,'completed');
assert.ok(passed.production.tasks[0].outputAssetIds.includes('distribution-1'));
assert.equal(passed.production.assets.find(a=>a.id==='distribution-1')?.mediaQa?.assetContentHash,'b'.repeat(64));

output=new Uint8Array([...box('ftyp'),...box('mdat',[5,6,7,8]),...box('moov',[1,2,3,4])]);
const failed=await executeProductionDistributionExport(project,{...request,outputAssetId:'failed-export'},runtime,store,resolve,()=> '2026-11-26T09:01:00.000Z');
assert.equal(failed.export.status,'qa_failed');
assert.equal(failed.asset.status,'failed');
assert.equal(failed.asset.mediaQa?.passed,false);
assert.equal(failed.production.tasks[0].status,'failed');
assert.equal(storeCount,1,'Failed QA output must not be stored as a deliverable');

await assert.rejects(()=>executeProductionDistributionExport({...project,approvals:[]},request,runtime,store,resolve),/master approval/);
await assert.rejects(()=>executeProductionDistributionExport({...project,assets:project.assets.map(a=>({...a,provenance:{...a.provenance,licence:undefined}}))},request,runtime,store,resolve),/licence evidence/);
await assert.rejects(()=>executeProductionDistributionExport({...project,assets:project.assets.map(a=>({...a,contentHash:'c'.repeat(64)}))},request,runtime,store,resolve),/do not match/);
await assert.rejects(()=>executeProductionDistributionExport({...project,tasks:[{...project.tasks[0],status:'blocked',blockedReason:'approval'}]},request,runtime,store,resolve),/not runnable/);

await assert.rejects(()=>executeProductionDistributionExport({
  ...project,
  tasks:[{...project.tasks[0],inputAssetIds:[]}],
},request,runtime,store,resolve),/declared as an input/);
await assert.rejects(()=>executeProductionDistributionExport(project,{
  ...request,outputAssetId:'unsafe-key-export',objectKey:'projects/other-film/exports/out.mp4',
},runtime,store,resolve),/project’s exports namespace/);

let persistedGraph: CinematicProduction = project;
const calls: Array<{ url: string; method: string; body?: any; secret?: string | null }> = [];
const apiFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ url, method, body, secret: new Headers(init?.headers).get('x-creator-generation-secret') });
  if (method === 'GET') return new Response(JSON.stringify({ production: persistedGraph }), { status: 200 });
  if (method === 'PATCH') {
    assert.equal(body.production.assets.find((a: any) => a.id === 'distribution-1')?.mediaQa, undefined, 'generic PATCH must never carry QA evidence');
    persistedGraph = body.production as CinematicProduction;
    return new Response(JSON.stringify({ status: 'updated' }), { status: 200 });
  }
  if (method === 'POST') {
    const evidence = body.evidence;
    persistedGraph = {
      ...persistedGraph,
      assets: persistedGraph.assets.map(a => a.id === 'distribution-1' ? { ...a, mediaQa: evidence } : a),
    };
    return new Response(JSON.stringify({ status: 'recorded' }), { status: 200 });
  }
  return new Response('not found', { status: 404 });
};
const persisted = await persistProductionExportResult('https://creator.example', 'film-1', passed, 'worker-secret', apiFetch);
assert.equal(persisted.graphStatus, 200);
assert.equal(persisted.qaStatus, 200);
assert.deepEqual(calls.map(call => call.method), ['GET', 'PATCH', 'POST']);
assert.ok(calls.every(call => call.secret === 'worker-secret'), 'all persistence calls carry the service credential');
assert.equal(persistedGraph.assets.find(a => a.id === 'distribution-1')?.mediaQa?.passed, true);
const beforeRetry = calls.length;
await persistProductionExportResult('https://creator.example', 'film-1', passed, 'worker-secret', apiFetch);
assert.equal(calls.length, beforeRetry + 1, 'retry of an already persisted result only reads and does not duplicate writes');
assert.equal(calls.at(-1)?.method, 'GET');

let partialGraph: CinematicProduction = project;
let failQaOnce = true;
const partialFetch: typeof fetch = async (input, init) => {
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  if (method === 'GET') return new Response(JSON.stringify({ production: partialGraph }), { status: 200 });
  if (method === 'PATCH') {
    partialGraph = body.production as CinematicProduction;
    return new Response('{}', { status: 200 });
  }
  if (method === 'POST' && failQaOnce) {
    failQaOnce = false;
    return new Response('temporary error', { status: 503 });
  }
  if (method === 'POST') {
    partialGraph = { ...partialGraph, assets: partialGraph.assets.map(a => a.id === 'distribution-1' ? { ...a, mediaQa: body.evidence } : a) };
    return new Response('{}', { status: 200 });
  }
  return new Response('{}', { status: 404 });
};
await assert.rejects(() => persistProductionExportResult('https://creator.example', 'film-1', passed, 'worker-secret', partialFetch), /distribution stays gated/);
assert.equal(partialGraph.assets.find(a => a.id === 'distribution-1')?.mediaQa, undefined, 'partial persistence must leave delivery gated');
await persistProductionExportResult('https://creator.example', 'film-1', passed, 'worker-secret', partialFetch);
assert.equal(partialGraph.assets.find(a => a.id === 'distribution-1')?.mediaQa?.passed, true, 'retry completes QA persistence without repeating the graph PATCH');

console.log('IZAKHONO production-graph to FFmpeg distribution worker integration: PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
