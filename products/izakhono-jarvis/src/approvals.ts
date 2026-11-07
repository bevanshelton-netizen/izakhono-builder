// Owner-only proposal and append-only decision/audit ledger. This module never executes actions.
export interface JarvisApprovalDb {
  prepare(sql:string): { bind(...values:unknown[]): { all<T=Record<string,unknown>>():Promise<{results?:T[]}>; first<T=Record<string,unknown>>():Promise<T|null>; run():Promise<{meta?:{changes?:number}}> } };
}
export interface JarvisApprovalEnv { DB: JarvisApprovalDb; }
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const TYPES=new Set(["create_task","update_task","prepare_report","request_integration","publish_content","financial_action","infrastructure_change","other"]);
const RISKS=new Set(["low","medium","high","critical"]);
const STATUSES=new Set(["proposed","approved","rejected","expired","cancelled"]);
const id=(prefix:string)=>prefix+"_"+crypto.randomUUID().replaceAll("-","");
async function audit(db:JarvisApprovalDb,type:string,subjectType:string,subjectId:string,detail:unknown){
 await db.prepare("INSERT INTO jarvis_audit_events(id,owner_scope,event_type,subject_type,subject_id,detail_json) VALUES(?,'owner',?,?,?,?)")
 .bind(id("aud"),type,subjectType,subjectId,JSON.stringify(detail??{})).run();
}
export async function jarvisApprovalsRoute(req:Request,env:JarvisApprovalEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const url=new URL(req.url), path=url.pathname;
 const decisionMatch=path.match(/^\/api\/jarvis\/proposals\/([^/]+)\/decision$/);
 const itemMatch=path.match(/^\/api\/jarvis\/proposals\/([^/]+)$/);
 const collection=path==="/api/jarvis/proposals", auditCollection=path==="/api/jarvis/audit";
 if(!collection&&!auditCollection&&!itemMatch&&!decisionMatch)return null;
 const allowed=collection?["GET","POST"]:auditCollection?["GET"]:decisionMatch?["POST"]:["GET"];
 if(!allowed.includes(req.method))return new Response("Method not allowed",{status:405,headers:{allow:allowed.join(", "), "cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return json({ok:false,error:"Unauthorized"},401);
 if(auditCollection){
  const limitRaw=url.searchParams.get("limit"),limit=limitRaw===null?50:Number(limitRaw);
  if(!Number.isInteger(limit)||limit<1||limit>100)return json({ok:false,error:"limit must be an integer from 1 to 100"},400);
  const result=await env.DB.prepare("SELECT id,event_type,subject_type,subject_id,detail_json,created_at FROM jarvis_audit_events WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json({ok:true,events:result.results||[],limit,scope:"owner",append_only:true});
 }
 if(req.method==="GET"){
  if(itemMatch){
   const item=await env.DB.prepare("SELECT id,action_type,title,description,payload_json,risk_level,status,expires_at,created_at,updated_at FROM jarvis_action_proposals WHERE owner_scope='owner' AND id=?").bind(decodeURIComponent(itemMatch[1])).first();
   if(!item)return json({ok:false,error:"Proposal not found"},404);
   const decisions=await env.DB.prepare("SELECT decision,reason,decided_at FROM jarvis_proposal_decisions WHERE owner_scope='owner' AND proposal_id=?").bind(decodeURIComponent(itemMatch[1])).all();
   return json({ok:true,proposal:item,decisions:decisions.results||[],execution:"not-performed"});
  }
  const raw=url.searchParams.get("limit"),limit=raw===null?25:Number(raw),status=url.searchParams.get("status");
  if(!Number.isInteger(limit)||limit<1||limit>50)return json({ok:false,error:"limit must be an integer from 1 to 50"},400);
  if(status&&!STATUSES.has(status))return json({ok:false,error:"Invalid proposal status"},400);
  const result=status
   ?await env.DB.prepare("SELECT id,action_type,title,description,risk_level,status,expires_at,created_at,updated_at FROM jarvis_action_proposals WHERE owner_scope='owner' AND status=? ORDER BY created_at DESC LIMIT ?").bind(status,limit).all()
   :await env.DB.prepare("SELECT id,action_type,title,description,risk_level,status,expires_at,created_at,updated_at FROM jarvis_action_proposals WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json({ok:true,proposals:result.results||[],limit,scope:"owner"});
 }
 let payload:any;try{payload=await req.json();}catch{return json({ok:false,error:"Expected application/json"},400);}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return json({ok:false,error:"Expected a JSON object"},400);
 if(collection){
  const actionType=payload.action_type,title=typeof payload.title==="string"?payload.title.trim():"",description=typeof payload.description==="string"?payload.description.trim():"";
  const risk=payload.risk_level||"medium",data=payload.payload===undefined?{}:payload.payload,expires=payload.expires_at??null;
  if(typeof actionType!=="string"||!TYPES.has(actionType))return json({ok:false,error:"Unsupported action_type"},400);
  if(!title||title.length>160||!description||description.length>4000)return json({ok:false,error:"title (1–160) and description (1–4000) are required"},400);
  if(typeof risk!=="string"||!RISKS.has(risk))return json({ok:false,error:"Invalid risk_level"},400);
  let payloadJson:string;try{payloadJson=JSON.stringify(data);}catch{return json({ok:false,error:"payload must be JSON"},400);}
  if(payloadJson.length>8000)return json({ok:false,error:"payload must be 8000 characters or fewer"},400);
  if(expires!==null&&(typeof expires!=="string"||!Number.isFinite(Date.parse(expires))))return json({ok:false,error:"expires_at must be a valid date"},400);
  const proposalId=id("prp");
  await env.DB.prepare("INSERT INTO jarvis_action_proposals(id,owner_scope,action_type,title,description,payload_json,risk_level,expires_at) VALUES(?,'owner',?,?,?,?,?,?)").bind(proposalId,actionType,title,description,payloadJson,risk,expires).run();
  await audit(env.DB,"proposal.created","proposal",proposalId,{action_type:actionType,risk_level:risk});
  return json({ok:true,proposal:{id:proposalId,action_type:actionType,title,description,payload:data,risk_level:risk,status:"proposed",expires_at:expires},execution:"not-performed"},201);
 }
 const proposalId=decodeURIComponent(decisionMatch![1]),decision=payload.decision,reason=typeof payload.reason==="string"?payload.reason.trim():"";
 if(decision!=="approved"&&decision!=="rejected")return json({ok:false,error:"decision must be approved or rejected"},400);
 if(!reason||reason.length>2000)return json({ok:false,error:"A reason of 1–2000 characters is required"},400);
 const proposal=await env.DB.prepare("SELECT id,status,expires_at FROM jarvis_action_proposals WHERE owner_scope='owner' AND id=?").bind(proposalId).first<any>();
 if(!proposal)return json({ok:false,error:"Proposal not found"},404);
 if(proposal.status!=="proposed")return json({ok:false,error:"Proposal already has a terminal status"},409);
 if(proposal.expires_at&&Date.parse(proposal.expires_at)<=Date.now())return json({ok:false,error:"Proposal has expired"},409);
 const decisionId=id("dec");
 try{
  await env.DB.prepare("INSERT INTO jarvis_proposal_decisions(id,proposal_id,owner_scope,decision,reason) VALUES(?,?,'owner',?,?)").bind(decisionId,proposalId,decision,reason).run();
 }catch{return json({ok:false,error:"A decision has already been recorded for this proposal"},409);}
 await env.DB.prepare("UPDATE jarvis_action_proposals SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_scope='owner' AND status='proposed'").bind(decision,proposalId).run();
 await audit(env.DB,"proposal."+decision,"proposal",proposalId,{decision_id:decisionId,reason});
 return json({ok:true,proposal_id:proposalId,decision,decision_id:decisionId,execution:"not-performed",message:"Decision recorded. No external action was executed."},201);
}
