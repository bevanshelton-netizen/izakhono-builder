import assert from "node:assert/strict";
import {jarvisConversationsRoute} from "./conversations";
const req=(path:string,method="GET",body?:unknown)=>new Request("https://builder.example"+path,{method,headers:body?{"content-type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
async function main(){
 let reads=0,writes=0,stored:any=null;const env={DB:{prepare(sql:string){return{bind(...args:unknown[]){return{
  async all(){reads++;return{results:[]}},
  async first(){reads++;return sql.includes("FROM jarvis_conversations WHERE")?{id:"cnv_1",title:"Planning",status:"active"}:null},
  async run(){writes++;stored={sql,args};return{}}
 };}}}}};
 assert.equal((await jarvisConversationsRoute(req("/api/jarvis/conversations"),env,async()=>false))?.status,401);assert.equal(reads,0);
 assert.equal((await jarvisConversationsRoute(req("/api/jarvis/conversations","POST",{title:"Planning"}),env,async()=>true))?.status,201);assert.equal(writes,1);
 const denied=await jarvisConversationsRoute(req("/api/jarvis/conversations/cnv_1/messages","POST",{role:"user",content:"hello"}),env,async()=>false);assert.equal(denied?.status,401);
 const saved=await jarvisConversationsRoute(req("/api/jarvis/conversations/cnv_1/messages","POST",{role:"user",content:"hello"}),env,async()=>true);assert.equal(saved?.status,201);assert.equal((saved&&await saved.json() as any).persistence,"saved");assert.equal(writes,3);
 const invalid=await jarvisConversationsRoute(req("/api/jarvis/conversations/cnv_1/messages","POST",{role:"system",content:"x"}),env,async()=>true);assert.equal(invalid?.status,400);
 const missing=await jarvisConversationsRoute(req("/api/jarvis/conversations/not-found"),{DB:{prepare(){return{bind(){return{async first(){return null},async all(){return{results:[]}},async run(){return{}}}}}}}},async()=>true);assert.equal(missing?.status,404);
 assert.equal(await jarvisConversationsRoute(req("/other"),env,async()=>true),null);
 console.log("J.A.R.V.I.S. conversation persistence tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
