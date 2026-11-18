// Persistent, owner-only J.A.R.V.I.S. conversation history. No model calls or action execution.
export interface JarvisConversationDb {
 prepare(sql:string):{bind(...values:unknown[]):{
  all<T=Record<string,unknown>>():Promise<{results?:T[]}>;
  first<T=Record<string,unknown>>():Promise<T|null>;
  run():Promise<unknown>;
 }};
}
export interface JarvisConversationEnv{DB:JarvisConversationDb;}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const id=(prefix:string)=>prefix+"_"+crypto.randomUUID().replaceAll("-","");
export async function jarvisConversationsRoute(req:Request,env:JarvisConversationEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const path=new URL(req.url).pathname;
 const messagesMatch=path.match(/^\/api\/jarvis\/conversations\/([^/]+)\/messages$/);
 const itemMatch=path.match(/^\/api\/jarvis\/conversations\/([^/]+)$/);
 const collection=path==="/api/jarvis/conversations";
 if(!collection&&!itemMatch&&!messagesMatch)return null;
 const methods=collection?["GET","POST"]:messagesMatch?["GET","POST"]:["GET"];
 if(!methods.includes(req.method))return new Response("Method not allowed",{status:405,headers:{allow:methods.join(", "),"cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return json({ok:false,error:"Unauthorized"},401);
 if(collection&&req.method==="GET"){
  const raw=new URL(req.url).searchParams.get("limit"),limit=raw===null?25:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>50)return json({ok:false,error:"limit must be an integer from 1 to 50"},400);
  const rows=await env.DB.prepare("SELECT c.id,c.title,c.status,c.created_at,c.updated_at,(SELECT COUNT(*) FROM jarvis_messages m WHERE m.conversation_id=c.id AND m.owner_scope='owner') AS message_count,(SELECT content FROM jarvis_messages m WHERE m.conversation_id=c.id AND m.owner_scope='owner' ORDER BY m.created_at DESC LIMIT 1) AS last_message FROM jarvis_conversations c WHERE c.owner_scope='owner' ORDER BY c.updated_at DESC LIMIT ?").bind(limit).all();
  return json({ok:true,conversations:rows.results||[],limit,scope:"owner"});
 }
 if(collection&&req.method==="POST"){
  let p:any;try{p=await req.json()}catch{return json({ok:false,error:"Expected application/json"},400)}
  const title=typeof p?.title==="string"?p.title.trim():"";
  if(!title||title.length>160)return json({ok:false,error:"title is required and must be 1–160 characters"},400);
  const conversationId=id("cnv");
  await env.DB.prepare("INSERT INTO jarvis_conversations(id,owner_scope,title) VALUES(?,'owner',?)").bind(conversationId,title).run();
  return json({ok:true,conversation:{id:conversationId,title,status:"active"},scope:"owner"},201);
 }
 const conversationId=decodeURIComponent((messagesMatch||itemMatch)![1]);
 const conversation=await env.DB.prepare("SELECT id,title,status,created_at,updated_at FROM jarvis_conversations WHERE owner_scope='owner' AND id=?").bind(conversationId).first();
 if(!conversation)return json({ok:false,error:"Conversation not found"},404);
 if(itemMatch)return json({ok:true,conversation,scope:"owner"});
 if(req.method==="GET"){
  const raw=new URL(req.url).searchParams.get("limit"),limit=raw===null?100:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>200)return json({ok:false,error:"limit must be an integer from 1 to 200"},400);
  const rows=await env.DB.prepare("SELECT id,role,content,agent_id,created_at FROM jarvis_messages WHERE owner_scope='owner' AND conversation_id=? ORDER BY created_at ASC LIMIT ?").bind(conversationId,limit).all();
  return json({ok:true,conversation_id:conversationId,messages:rows.results||[],limit,scope:"owner"});
 }
 let p:any;try{p=await req.json()}catch{return json({ok:false,error:"Expected application/json"},400)}
 const role=p?.role,content=typeof p?.content==="string"?p.content.trim():"",agentId=p?.agent_id??null;
 if(role!=="user"&&role!=="assistant")return json({ok:false,error:"role must be user or assistant"},400);
 if(!content||content.length>12000)return json({ok:false,error:"content is required and must be 1–12000 characters"},400);
 if(agentId!==null&&(typeof agentId!=="string"||agentId.length>80))return json({ok:false,error:"agent_id must be a string of at most 80 characters"},400);
 const messageId=id("msg");
 await env.DB.prepare("INSERT INTO jarvis_messages(id,conversation_id,owner_scope,role,content,agent_id) VALUES(?,?,'owner',?,?,?)").bind(messageId,conversationId,role,content,agentId).run();
 await env.DB.prepare("UPDATE jarvis_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_scope='owner'").bind(conversationId).run();
 return json({ok:true,message:{id:messageId,conversation_id:conversationId,role,content,agent_id:agentId},persistence:"saved"},201);
}
