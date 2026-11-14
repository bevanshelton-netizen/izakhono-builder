import {strict as assert} from 'node:assert';
import {completeVerifiedSupervisorJob} from './supervisor-store';

const calls:Array<{sql:string;values:unknown[]}>=[];
const db={prepare(sql:string){const call={sql,values:[] as unknown[]};calls.push(call);return{bind(...values:unknown[]){call.values=values;return this;},async run(){return{meta:{changes:1}};},async first(){return null;},async all(){return{results:[]};}};}};
const result=await completeVerifiedSupervisorJob(db as never,'job-1',{completion:'release-checks'},'completion-gate');
assert.deepEqual(result,{id:'job-1',status:'completed',updatedAt:result.updatedAt});
assert.equal(calls.length,1,'completion evidence and status must be one database statement');
assert.match(calls[0].sql,/UPDATE supervisor_jobs SET status='completed',evidence_json=/);
assert.match(calls[0].sql,/WHERE id=\? AND status='verified'/,'only verified jobs may complete');
assert.deepEqual(calls[0].values.slice(0,1),[JSON.stringify({completion:'release-checks'})]);
assert.equal(calls[0].values[2],'completion-gate');
assert.deepEqual(JSON.parse(String(calls[0].values[3])),{completionEvidenceRecorded:true});
assert.equal(calls[0].values[4],'job-1');
console.log('supervisor store atomic completion contract: ok');
