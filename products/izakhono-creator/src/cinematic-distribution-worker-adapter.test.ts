import assert from 'node:assert/strict';
import { handleDistributionExportRequest } from './cinematic-distribution-worker-adapter';
import type { CreatorD1Database, CreatorD1PreparedStatement } from './project-store';
import type { CinematicProduction } from './cinematic-production-graph';
import type { MediaExportRuntime } from './media-export-executor';

function box(type: string, payload: number[] = []): number[] {
  const size = payload.length + 8;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...Array.from(type).map(char => char.charCodeAt(0)), ...payload];
}
const mp4 = new Uint8Array([...box('ftyp'), ...box('moov', [1,2,3,4]), ...box('mdat', [5,6,7,8])]);
const source = new Uint8Array([1,2,3,4]);
const digest = 'a'.repeat(64);
const probe = JSON.stringify({ streams: [
  { codec_type:'video', codec_name:'h264', width:1080, height:1920, pix_fmt:'yuv420p', avg_frame_rate:'30/1' },
  { codec_type:'audio', codec_name:'aac', sample_rate:'48000', channels:2 },
], format:{ format_name:'mov,mp4,m4a,3gp,3g2,mj2', duration:'10' } });

function graph(): CinematicProduction {
  return {
    schema:'izakhono.cinematic/production-v1', id:'film-1', title:'Test Film', brief:'Test', status:'planned', format:'film', publicLive:false,
    characters:[], locations:[], props:[], scenes:[], shots:[], references:[],
    assets:[{ id:'master-1', kind:'video', status:'completed', source:'assembled', role:'master', storageKey:'masters/master-1.mp4', contentHash:digest, parentAssetIds:[], provenance:{createdAt:'2026-11-26T00:00:00.000Z', licence:'Original owned footage', consentRecordIds:[]} }],
    tasks:[{id:'export-task',kind:'export',status:'ready',dependsOnTaskIds:[],inputAssetIds:['master-1'],outputAssetIds:[],attempts:0}],
    approvals:[{id:'master-approval',gate:'master',status:'approved',approverId:'producer-1',decidedAt:'2026-11-26T08:00:00.000Z'}],
    metadata:{createdAt:'2026-11-26T00:00:00.000Z',updatedAt:'2026-11-26T00:00:00.000Z',ownerId:'owner-1',tags:[],version:1},
  };
}

function database(options: { conflictOnCommit?: boolean } = {}) {
  const state = {
    updatedAt:'2026-11-26T09:00:00.000Z',
    brief:'Test',
    packageJson:JSON.stringify({ cinematicProduction:graph(), retained:'yes' }),
    conflictOnCommit:Boolean(options.conflictOnCommit),
    reads:0,
    writes:0,
  };
  const db: CreatorD1Database = {
    async batch() { return undefined; },
    prepare(query: string): CreatorD1PreparedStatement {
      return {
        bind(...values: unknown[]) {
          return {
            async run() { return undefined; },
            async all<T>() { return { results: [] as T[] }; },
            async first<T>() {
              if (query.includes('SELECT * FROM creator_projects')) {
                state.reads++;
                return { id:'film-1', brief:state.brief, package_json:state.packageJson, created_at:'2026-11-26T08:00:00.000Z', updated_at:state.updatedAt } as T;
              }
              if (query.includes('UPDATE creator_projects')) {
                state.writes++;
                if (state.conflictOnCommit) {
                  state.updatedAt='2026-11-26T09:05:00.000Z';
                  state.conflictOnCommit=false;
                }
                const [brief, packageJson, nextUpdatedAt, id, expected] = values;
                if (id !== 'film-1' || expected !== state.updatedAt) return null;
                state.brief=String(brief);
                state.packageJson=String(packageJson);
                state.updatedAt=String(nextUpdatedAt);
                return { id:'film-1' } as T;
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { db, state };
}

function dependencies(deleted: string[], options: { deleteFails?: boolean } = {}) {
  const runtime: MediaExportRuntime = {
    async run(command) { return { stdout: command === 'ffprobe' ? probe : '', stderr:'' }; },
    async readFile(path) { return path === '/worker/master.mp4' ? source : mp4; },
    async writeFile() {},
    async sha256(bytes) { return bytes === source ? digest : 'b'.repeat(64); },
  };
  let puts=0;
  return {
    runtime,
    get puts() { return puts; },
    authenticate:async()=>true,
    workerIdentity:'node-worker-test',
    async allocateOutputPath() { return '/worker/distribution.mp4'; },
    async resolveStoredAsset(key:string) { assert.equal(key,'masters/master-1.mp4'); return '/worker/master.mp4'; },
    store:{
      async put(key:string,bytes:Uint8Array,metadata:{contentType:string;sha256:string}) {
        puts++; assert.equal(key,'projects/film-1/exports/distribution-1.mp4');
        assert.equal(bytes.byteLength,mp4.byteLength); assert.equal(metadata.sha256,'b'.repeat(64));
      },
      async delete(key:string) {
        if(options.deleteFails) throw new Error('simulated delete failure');
        deleted.push(key);
      },
    },
    now:()=> '2026-11-26T09:10:00.000Z',
  };
}

function request(expectedUpdatedAt='2026-11-26T09:00:00.000Z') {
  return new Request('https://worker.invalid/internal/creator/projects/film-1/distribution-export', {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({expectedUpdatedAt,masterAssetId:'master-1',exportTaskId:'export-task',outputAssetId:'distribution-1',outputPath:'/etc/passwd',objectKey:'other-project/file.mp4'}),
  });
}

async function main() {
  const deleted:string[]=[];
  const successDb=database();
  const successDeps=dependencies(deleted);
  const success=await handleDistributionExportRequest(request(),{DB:successDb.db},successDeps);
  assert.equal(success?.status,201);
  assert.equal(successDeps.puts,1);
  assert.equal(deleted.length,0);
  const saved=JSON.parse(successDb.state.packageJson) as {cinematicProduction:CinematicProduction;retained:string};
  assert.equal(saved.retained,'yes');
  assert.ok(saved.cinematicProduction.assets.some(asset=>asset.id==='distribution-1'));
  assert.equal(saved.cinematicProduction.tasks[0].status,'completed');

  const conflictDb=database({conflictOnCommit:true});
  const conflictDeps=dependencies(deleted);
  const conflict=await handleDistributionExportRequest(request(),{DB:conflictDb.db},conflictDeps);
  assert.equal(conflict?.status,409);
  assert.equal(conflictDeps.puts,1);
  assert.equal(deleted.at(-1),'projects/film-1/exports/distribution-1.mp4');

  const staleDb=database();
  const stale=await handleDistributionExportRequest(request('2026-11-26T08:00:00.000Z'),{DB:staleDb.db},dependencies(deleted));
  assert.equal(stale?.status,409);
  assert.equal(staleDb.state.writes,0);

  const unauthDb=database();
  const unauthorized=await handleDistributionExportRequest(request(),{DB:unauthDb.db},{
    ...dependencies(deleted), authenticate:async()=>false,
  });
  assert.equal(unauthorized?.status,401);
  assert.equal(unauthDb.state.reads,0);

  const cleanupDb=database({conflictOnCommit:true});
  const cleanupFailure=await handleDistributionExportRequest(request(),{DB:cleanupDb.db},dependencies(deleted,{deleteFails:true}));
  assert.equal(cleanupFailure?.status,500);
  const cleanupBody=await cleanupFailure!.json() as {objectKey?:string};
  assert.equal(cleanupBody.objectKey,'projects/film-1/exports/distribution-1.mp4');
  console.log('Creator authenticated distribution worker adapter and CAS reconciliation: PASS');
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
