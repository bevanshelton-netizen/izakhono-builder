const SUPA=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET="identity-evidence", MAX=10*1024*1024;
const MIME:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};
const enc=new TextEncoder();
function out(data:unknown,status=200,origin="*"){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","access-control-allow-origin":origin,"access-control-allow-headers":"authorization, apikey, content-type, x-request-id","access-control-allow-methods":"GET,POST,OPTIONS"}})}
function bad(msg:string,status=400,origin="*"){return out({ok:false,error:msg},status,origin)}
function originFor(req:Request){const o=req.headers.get("origin")||"*";const a=(Deno.env.get("IDENTITY_ALLOWED_ORIGINS")||"").split(";").map(x=>x.trim()).filter(Boolean);return !a.length||a.includes(o)?o:"null"}
function headers(extra:Record<string,string>={}){return {"apikey":KEY,"authorization":"Bearer "+KEY,...extra}}
async function authUser(req:Request){const token=(req.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");if(!token)return null;const r=await fetch(SUPA+"/auth/v1/user",{headers:{"apikey":KEY,"authorization":"Bearer "+token}});if(!r.ok)return null;const u=await r.json();return typeof u.id==="string"?u.id:null}
async function hash(v:Uint8Array|string){const b=typeof v==="string"?enc.encode(v):v;const h=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function db(table:string,q="",init:RequestInit={}){const h=new Headers(init.headers||{});h.set("apikey",KEY);h.set("authorization","Bearer "+KEY);h.set("accept-profile","identity");if(init.method&&init.method!=="GET")h.set("content-profile","identity");if(init.body&&!h.has("content-type"))h.set("content-type","application/json");const r=await fetch(SUPA+"/rest/v1/"+table+(q?"?"+q:""),{...init,headers:h});const t=await r.text();if(!r.ok)throw new Error("identity_db_"+r.status+":"+t.slice(0,180));return t?JSON.parse(t):null}
const txt=(v:unknown,n=100)=>typeof v==="string"?v.trim().slice(0,n):"";
const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function log(uid:string,event:string,subject:string|null,caseId:string|null,payload:unknown){await db("audit_events","",{method:"POST",headers:{"prefer":"return=minimal"},body:JSON.stringify({event_type:event,actor_type:"user",actor_ref_hash:await hash(uid),subject_id:subject,case_id:caseId,payload_sha256:await hash(JSON.stringify(payload))})})}
async function owned(id:string,uid:string){if(!isUuid(id))return null;const r=await db("verification_cases","id=eq."+id+"&opened_by=eq."+uid+"&select=*");return r?.[0]||null}
async function store(path:string,file:File){const url=SUPA+"/storage/v1/object/"+BUCKET+"/"+path.split("/").map(encodeURIComponent).join("/");const r=await fetch(url,{method:"POST",headers:headers({"content-type":file.type,"x-upsert":"false"}),body:await file.arrayBuffer()});if(!r.ok)throw new Error("private_upload_"+r.status)}
export async function handleIdentity(req:Request,u:URL):Promise<Response|null>{
 const parts=u.pathname.split("/").filter(Boolean),ix=parts.indexOf("identity");if(ix<0)return null;
 const origin=originFor(req);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-headers":"authorization, apikey, content-type, x-request-id","access-control-allow-methods":"GET,POST,OPTIONS","access-control-max-age":"86400"}});
 const uid=await authUser(req);if(!uid)return bad("Valid authenticated session required.",401,origin);
 const r=parts.slice(ix+1),method=req.method;
 try{
  if(method==="GET"&&r.length===1&&r[0]==="health")return out({ok:true,service:"IZAKHONO Identity & Business Verification",version:"1.0.0",storage:"private",provider_integrations:"not_configured",decision_mode:"fail_closed"},200,origin);
  if(method==="POST"&&r.length===1&&r[0]==="cases"){
   const b=await req.json(),st=txt(b.subject_type,20),vt=txt(b.verification_type,3).toUpperCase(),cc=txt(b.country_code,2).toUpperCase(),pc=txt(b.product_code,50);
   if(!["individual","business"].includes(st)||!["KYC","KYB"].includes(vt)||!/^[A-Z]{2}$/.test(cc)||!/^[A-Za-z0-9._-]{2,50}$/.test(pc))return bad("Invalid subject_type, verification_type, country_code or product_code.",422,origin);
   if((st==="individual"&&vt!=="KYC")||(st==="business"&&vt!=="KYB"))return bad("KYC is for individuals; KYB is for businesses.",422,origin);
   let s:any;
   if(st==="individual"){const found=await db("subjects","auth_user_id=eq."+uid+"&subject_type=eq.individual&select=*");s=found?.[0];}
   if(!s)s=(await db("subjects","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({subject_type:st,auth_user_id:uid,country_code:cc,source_system:"izakhono_identity_api"})}))[0];
   const c=(await db("verification_cases","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({subject_id:s.id,verification_type:vt,product_code:pc,country_code:cc,opened_by:uid,status:"draft"})}))[0];
   await log(uid,"case_created",s.id,c.id,{verification_type:vt,product_code:pc,country_code:cc});
   return out({ok:true,subject:{id:s.id,subject_type:s.subject_type,country_code:s.country_code},case:c},201,origin)
  }
  if(method==="GET"&&r.length===1&&r[0]==="cases"){const rows=await db("verification_cases","opened_by=eq."+uid+"&select=*&order=created_at.desc");return out({ok:true,cases:rows},200,origin)}
  if(r[0]!=="cases"||r.length<2)return bad("Route not found.",404,origin);
  const caseId=r[1],c=await owned(caseId,uid);if(!c)return bad("Verification case not found.",404,origin);
  if(method==="GET"&&r.length===2){const [ev,sc,de]=await Promise.all([db("evidence","case_id=eq."+caseId+"&select=id,evidence_type,status,issuer_code,issued_at,expires_on,created_at"),db("screenings","case_id=eq."+caseId+"&select=id,screening_type,provider_code,outcome,checked_at,expires_at"),db("decisions","case_id=eq."+caseId+"&select=id,decision,risk_score,risk_level,reason_codes,policy_version,created_at")]);return out({ok:true,case:c,evidence:ev,screenings:sc,decisions:de},200,origin)}
  if(method==="POST"&&r.length===3&&r[2]==="evidence"){
   if(!["draft","in_review"].includes(c.status))return bad("Evidence cannot be added to a closed case.",409,origin);
   const form=await req.formData(),file=form.get("file"),type=txt(form.get("evidence_type"),60);
   if(!(file instanceof File)||!type)return bad("Attach a file and evidence_type.",422,origin);
   if(file.size<1||file.size>MAX)return bad("Evidence must be 1 byte to 10 MB.",413,origin);
   if(!MIME[file.type])return bad("Only PDF, JPEG and PNG are accepted.",415,origin);
   const bytes=new Uint8Array(await file.arrayBuffer());
   const valid=file.type==="application/pdf"?new TextDecoder().decode(bytes.slice(0,5))==="%PDF-":file.type==="image/png"?bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   if(!valid)return bad("File content does not match its declared MIME type.",415,origin);
   const digest=await hash(bytes),path=uid+"/"+caseId+"/"+crypto.randomUUID()+"."+MIME[file.type];
   await store(path,new File([bytes],"evidence."+MIME[file.type],{type:file.type}));
   try{const ev=(await db("evidence","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({case_id:caseId,evidence_type:type,storage_bucket:BUCKET,storage_object_path:path,content_sha256:digest,status:"submitted",submitted_by:uid,metadata:{mime_type:file.type,size_bytes:file.size}})}))[0];await log(uid,"evidence_uploaded",c.subject_id,caseId,{evidence_id:ev.id,sha256:digest,mime_type:file.type,size_bytes:file.size});return out({ok:true,evidence:{id:ev.id,evidence_type:type,status:ev.status,sha256:digest}},201,origin)}catch(e){await fetch(SUPA+"/storage/v1/object/"+BUCKET+"/"+path.split("/").map(encodeURIComponent).join("/"),{method:"DELETE",headers:headers()}).catch(()=>{});throw e}
  }
  if(method==="POST"&&r.length===3&&r[2]==="submit"){
   if(!["draft","in_review"].includes(c.status))return bad("Case is not submittable.",409,origin);
   const ev=await db("evidence","case_id=eq."+caseId+"&select=id,evidence_type,status");if(!ev.length)return bad("At least one evidence document is required.",422,origin);
   const needed=c.verification_type==="KYC"?"identity_document":"company_registration";if(!ev.some((x:any)=>x.evidence_type===needed))return bad("Required evidence type missing: "+needed,422,origin);
   const updated=(await db("verification_cases","id=eq."+caseId,{method:"PATCH",headers:{"prefer":"return=representation"},body:JSON.stringify({status:"submitted",submitted_at:new Date().toISOString()})}))[0];
   await log(uid,"case_submitted",c.subject_id,caseId,{evidence_count:ev.length});return out({ok:true,case:updated,message:"Submitted for review; submission is not approval."},200,origin)
  }
  if(method==="POST"&&r.length===3&&r[2]==="relationships"){
   if(c.verification_type!=="KYB")return bad("Relationships can only be added to KYB cases.",409,origin);
   const b=await req.json(),kind=txt(b.relationship_type,40),pct=b.ownership_percentage==null?null:Number(b.ownership_percentage);
   if(!["director","beneficial_owner","shareholder","trustee","partner","authorised_representative","controller"].includes(kind))return bad("Unsupported relationship_type.",422,origin);
   if(pct!==null&&(!Number.isFinite(pct)||pct<0||pct>100))return bad("Ownership percentage must be between 0 and 100.",422,origin);
   const person=(await db("subjects","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({subject_type:"individual",country_code:c.country_code,source_system:"kyb_relationship"})}))[0];
   const rel=(await db("subject_relationships","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({entity_subject_id:c.subject_id,person_subject_id:person.id,relationship_type:kind,ownership_percentage:pct,verification_status:"unverified"})}))[0];
   await log(uid,"kyb_relationship_added",c.subject_id,caseId,{relationship_type:kind,ownership_percentage:pct});return out({ok:true,relationship:rel,message:"Recorded as unverified; this does not satisfy KYB verification."},201,origin)
  }
  if(method==="POST"&&r.length===3&&r[2]==="consent"){
   const b=await req.json(),purpose=txt(b.purpose_code,80),recipient=txt(b.recipient_product,80),basis=txt(b.legal_basis,80),notice=txt(b.notice_version,40),scopes=Array.isArray(b.scopes)?b.scopes.map((x:unknown)=>txt(x,60)).filter(Boolean).slice(0,20):[];
   if(!purpose||!recipient||!basis||!notice||!scopes.length)return bad("Purpose, recipient, legal basis, notice version and scopes are required.",422,origin);
   const digest=await hash(JSON.stringify({uid,caseId,purpose,recipient,basis,notice,scopes,at:new Date().toISOString()}));
   const grant=(await db("consent_grants","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({subject_id:c.subject_id,granted_by:uid,purpose_code:purpose,recipient_product:recipient,scopes,legal_basis:basis,notice_version:notice,consent_record_sha256:digest})}))[0];
   await log(uid,"consent_granted",c.subject_id,caseId,{consent_id:grant.id,purpose,recipient,scopes});return out({ok:true,consent:{id:grant.id,status:grant.status,granted_at:grant.granted_at}},201,origin)
  }
  if(method==="POST"&&r.length===3&&r[2]==="evaluate"){
   const [ev,sc]=await Promise.all([db("evidence","case_id=eq."+caseId+"&select=id,status,evidence_type"),db("screenings","case_id=eq."+caseId+"&select=id,screening_type,outcome,expires_at")]);
   const types=c.verification_type==="KYC"?["identity_document","sanctions","pep"]:["company_registry","sanctions","pep"];
   const missing=types.filter(t=>!sc.some((x:any)=>x.screening_type===t&&x.outcome==="clear"&&x.expires_at&&new Date(x.expires_at)>new Date()));
   const reasons:string[]=[];if(!ev.length)reasons.push("EVIDENCE_MISSING");if(ev.some((x:any)=>x.status!=="validated"))reasons.push("EVIDENCE_NOT_VALIDATED");if(missing.length)reasons.push("PROVIDER_SCREENING_NOT_CONFIGURED");reasons.push("HUMAN_REVIEW_REQUIRED");
   const snapshot=await hash(JSON.stringify({case_id:caseId,evidence:ev,screenings:sc,policy:"ZA-KYC-KYB-1.0"}));
   const d=(await db("decisions","",{method:"POST",headers:{"prefer":"return=representation"},body:JSON.stringify({case_id:caseId,decision:"REVIEW",risk_score:50,risk_level:"medium",reason_codes:reasons,policy_version:"ZA-KYC-KYB-1.0",evidence_snapshot_sha256:snapshot,decided_by:uid,decision_origin:"rules_engine"})}))[0];
   await db("verification_cases","id=eq."+caseId,{method:"PATCH",body:JSON.stringify({status:"in_review",risk_level:"medium"})});await log(uid,"case_evaluated",c.subject_id,caseId,{decision:"REVIEW",reason_codes:reasons,snapshot});
   return out({ok:true,decision:d,message:"Fail-closed evaluation: manual review and authorised provider checks remain required."},200,origin)
  }
  return bad("Route not found.",404,origin)
 }catch(e){console.error("identity_api_error",e);return bad("Request failed. Check server logs using the request timestamp.",500,origin)}
}
