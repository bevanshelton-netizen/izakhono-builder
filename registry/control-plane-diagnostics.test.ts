import {strict as assert} from 'node:assert';
import {diagnoseControlPlane} from './control-plane-diagnostics';

const originalFetch=globalThis.fetch;
let calls:string[]=[];
globalThis.fetch=async(input:RequestInfo|URL)=>{
 const url=String(input);calls.push(url);
 if(url.includes('cloudflare-dns.com'))return {ok:true,status:200,json:async()=>({Status:0,Answer:[{data:'203.0.113.10'}]})} as Response;
 return {ok:true,status:200,url,json:async()=>({})} as Response;
};
const result=await diagnoseControlPlane('example.com');
assert.equal(result.domain,'example.com');
assert.equal(result.dns.ok,true);
assert.equal(result.https.ok,true);
assert.deepEqual(result.evidence,['dns_resolution_success','https_health_check']);
assert.equal(result.liveClaimEligible,true);
assert.equal(calls.length,4);
await assert.rejects(()=>diagnoseControlPlane('127.0.0.1'),/literal IP targets/);
globalThis.fetch=originalFetch;
console.log('IZAKHONO control-plane diagnostics tests passed');
