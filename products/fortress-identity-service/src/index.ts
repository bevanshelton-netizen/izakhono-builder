export interface Env {
 DB: D1Database; FORTRESS_SESSION_HMAC_SECRET: string; FORTRESS_BOOTSTRAP_SECRET: string;
 FORTRESS_SESSION_ISSUER?: string; FORTRESS_SESSION_AUDIENCE?: string; FORTRESS_ALLOWED_ORIGIN: string;
}
type Role = "OWNER"|"SECURITY_ADMIN"|"ANALYST"|"VIEWER";
type Principal = {id:string;tenant_id:string;email:string;display_name:string;role:Role;active:number;password_salt:string;password_hash:string;password_iterations:number};
const ACCESS=600, REFRESH=2592000, ITERATIONS=310000, enc=new TextEncoder();
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const unb64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const rnd=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b;};
const uid=()=>b64(rnd(18));
async function sha(s:string){const b=await crypto.subtle.digest("SHA-256",enc.encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function derive(password:string,salt:string,iterations:number){const k=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations,hash:"SHA-256"},k,256)));}
async function jwt(payload:Record<string,unknown>,secret:string){const h=b64(enc.encode(JSON.stringify({alg:"HS256",typ:"JWT"}))),p=b64(enc.encode(JSON.stringify(payload))),input=h+"."+p;const k=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return input+"."+b64(new Uint8Array(await crypto.subtle.sign("HMAC",k,enc.encode(input))));}
function res(body:unknown,status=200,headers:HeadersInit={}){const h=new Headers(headers);h.set("content-type","application/json; charset=utf-8");h.set("cache-control","no-store");h.set("x-content-type-options","nosniff");return new Response(JSON.stringify(body),{status,headers:h});}
function setCookie(n:string,v:string,age:number,http=true){return n+"="+v+"; Path=/; Max-Age="+age+"; Secure; SameSite=Strict"+(http?"; HttpOnly":"");}
function clearCookie(n:string,http=true){return setCookie(n,"",0,http);}
function jar(r:Request){return Object.fromEntries((r.headers.get("cookie")||"").split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)]}));}
async function body(r:Request){return r.json().catch(()=>null) as Promise<Record<string,unknown>|null>;}
const emailOk=(v:unknown):v is string=>typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const passOk=(v:unknown):v is string=>typeof v==="string"&&v.length>=14&&v.length<=256;
function originOk(r:Request,e:Env){return r.headers.get("origin")===e.FORTRESS_ALLOWED_ORIGIN&&r.headers.get("sec-fetch-site")!=="cross-site";}
async function audit(e:Env,type:string,outcome:string,pid:string|null,tid:string|null,r:Request,detail:Record<string,unknown>={}){const ip=r.headers.get("cf-connecting-ip")||"unknown";await e.DB.prepare("INSERT INTO audit_events(id,occurred_at,event_type,principal_id,tenant_id,outcome,source_ip_hash,detail_json) VALUES(?,?,?,?,?,?,?,?)").bind(uid(),Math.floor(Date.now()/1000),type,pid,tid,outcome,await sha(ip),JSON.stringify(detail)).run();}
async function limited(e:Env,key:string){const n=Math.floor(Date.now()/1000),x=await e.DB.prepare("SELECT failures,window_started_at,locked_until FROM login_attempts WHERE bucket=?").bind(key).first<{failures:number;window_started_at:number;locked_until:number|null}>();return !!x&&((x.locked_until||0)>n||(n-x.window_started_at<900&&x.failures>=8));}
async function failed(e:Env,key:string){const n=Math.floor(Date.now()/1000);await e.DB.prepare("INSERT INTO login_attempts(bucket,failures,window_started_at,locked_until) VALUES(?,1,?,NULL) ON CONFLICT(bucket) DO UPDATE SET failures=CASE WHEN ?-window_started_at>900 THEN 1 ELSE failures+1 END,window_started_at=CASE WHEN ?-window_started_at>900 THEN ? ELSE window_started_at END,locked_until=CASE WHEN (CASE WHEN ?-window_started_at>900 THEN 1 ELSE failures+1 END)>=8 THEN ?+900 ELSE locked_until END").bind(key,n,n,n,n,n,n).run();}
async function issue(e:Env,p:Principal,r:Request,replaceId?:string){
 const now=Math.floor(Date.now()/1000),sid=uid(),jti=uid(),refresh=b64(rnd(48));
 if(replaceId) await e.DB.prepare("UPDATE sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL").bind(now,replaceId).run();
 const token=await jwt({iss:e.FORTRESS_SESSION_ISSUER||"https://fortress.izakhono.internal",aud:e.FORTRESS_SESSION_AUDIENCE||"izakhono-creator",sub:p.id,tenant_id:p.tenant_id,role:p.role,active:true,iat:now,exp:now+ACCESS,jti},e.FORTRESS_SESSION_HMAC_SECRET);
 await e.DB.prepare("INSERT INTO sessions(id,principal_id,refresh_hash,access_jti,created_at,expires_at) VALUES(?,?,?,?,?,?)").bind(sid,p.id,await sha(refresh),jti,now,now+REFRESH).run();
 const h=new Headers();h.append("set-cookie",setCookie("__Host-izakhono_session",token,ACCESS));h.append("set-cookie",setCookie("__Host-izakhono_refresh",refresh,REFRESH));h.append("set-cookie",setCookie("__Host-izakhono_csrf",b64(rnd(32)),REFRESH,false));
 return {headers:h,body:{authenticated:true,principal:{id:p.id,tenantId:p.tenant_id,email:p.email,displayName:p.display_name,role:p.role},expiresIn:ACCESS}};
}
async function csrf(r:Request,e:Env){const c=jar(r);return originOk(r,e)&&!!c["__Host-izakhono_csrf"]&&c["__Host-izakhono_csrf"]===r.headers.get("x-csrf-token");}
async function bootstrap(r:Request,e:Env){
 if(!e.FORTRESS_BOOTSTRAP_SECRET||r.headers.get("x-fortress-bootstrap")!==e.FORTRESS_BOOTSTRAP_SECRET)return res({error:"Not found"},404);
 const x=await body(r);if(!x||!emailOk(x.email)||!passOk(x.password)||typeof x.displayName!=="string"||x.displayName.trim().length<2||typeof x.tenantName!=="string"||x.tenantName.trim().length<2)return res({error:"Invalid bootstrap payload; password must be at least 14 characters."},400);
 const n=await e.DB.prepare("SELECT COUNT(*) AS n FROM principals").first<{n:number}>();if((n?.n||0)>0)return res({error:"Bootstrap already completed"},409);
 const now=Math.floor(Date.now()/1000),tid="tenant_"+uid(),pid="principal_"+uid(),salt=b64(rnd(16)),hash=await derive(x.password,salt,ITERATIONS);
 await e.DB.batch([e.DB.prepare("INSERT INTO tenants(id,name,created_at) VALUES(?,?,?)").bind(tid,(x.tenantName as string).trim(),now),e.DB.prepare("INSERT INTO principals(id,tenant_id,email,display_name,role,password_salt,password_hash,password_iterations,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)").bind(pid,tid,(x.email as string).toLowerCase(),(x.displayName as string).trim(),"OWNER",salt,hash,ITERATIONS,now,now)]);
 await audit(e,"owner.bootstrap","success",pid,tid,r);return res({created:true,message:"Initial FORTRESS owner created. Remove the bootstrap secret immediately."},201);
}
async function login(r:Request,e:Env){
 if(!originOk(r,e))return res({error:"Origin rejected"},403);const x=await body(r);if(!x||!emailOk(x.email)||typeof x.password!=="string")return res({error:"Invalid credentials"},401);
 const mail=x.email.toLowerCase(),ip=r.headers.get("cf-connecting-ip")||"unknown",bucket=await sha(ip+"|"+mail);if(await limited(e,bucket))return res({error:"Too many attempts. Try again later."},429,{"retry-after":"900"});
 const p=await e.DB.prepare("SELECT id,tenant_id,email,display_name,role,active,password_salt,password_hash,password_iterations FROM principals WHERE email=?").bind(mail).first<Principal>();
 const salt=p?.password_salt||b64(new Uint8Array(16)),expected=p?.password_hash||await derive("dummy-password-value",salt,ITERATIONS),actual=await derive(x.password,salt,p?.password_iterations||ITERATIONS);
 if(!p||!p.active||actual!==expected){await failed(e,bucket);await audit(e,"auth.login","denied",p?.id||null,p?.tenant_id||null,r,{reason:"invalid_credentials"});return res({error:"Invalid credentials"},401);}
 await e.DB.prepare("DELETE FROM login_attempts WHERE bucket=?").bind(bucket).run();const issued=await issue(e,p,r);await audit(e,"auth.login","success",p.id,p.tenant_id,r);return res(issued.body,200,issued.headers);
}
async function refresh(r:Request,e:Env){
 if(!await csrf(r,e))return res({error:"CSRF validation failed"},403);const token=jar(r)["__Host-izakhono_refresh"];if(!token)return res({error:"Session unavailable"},401);
 const p=await e.DB.prepare("SELECT s.id AS session_id,p.id,p.tenant_id,p.email,p.display_name,p.role,p.active,p.password_salt,p.password_hash,p.password_iterations FROM sessions s JOIN principals p ON p.id=s.principal_id WHERE s.refresh_hash=? AND s.revoked_at IS NULL AND s.expires_at>?").bind(await sha(token),Math.floor(Date.now()/1000)).first<Principal&{session_id:string}>();
 if(!p||!p.active)return res({error:"Session unavailable"},401);const issued=await issue(e,p,r,p.session_id);await audit(e,"auth.refresh","success",p.id,p.tenant_id,r);return res(issued.body,200,issued.headers);
}
async function logout(r:Request,e:Env){
 if(!await csrf(r,e))return res({error:"CSRF validation failed"},403);const token=jar(r)["__Host-izakhono_refresh"];
 if(token){const s=await e.DB.prepare("SELECT id,principal_id FROM sessions WHERE refresh_hash=? AND revoked_at IS NULL").bind(await sha(token)).first<{id:string;principal_id:string}>();if(s){await e.DB.prepare("UPDATE sessions SET revoked_at=? WHERE id=?").bind(Math.floor(Date.now()/1000),s.id).run();await audit(e,"auth.logout","success",s.principal_id,null,r);}}
 const h=new Headers();h.append("set-cookie",clearCookie("__Host-izakhono_session"));h.append("set-cookie",clearCookie("__Host-izakhono_refresh"));h.append("set-cookie",clearCookie("__Host-izakhono_csrf",false));return res({authenticated:false},200,h);
}
async function me(r:Request,e:Env){
 const token=jar(r)["__Host-izakhono_session"];if(!token)return res({authenticated:false},401);const parts=token.split(".");if(parts.length!==3)return res({authenticated:false},401);
 try{const payload=JSON.parse(new TextDecoder().decode(unb64(parts[1]))) as {sub:string;jti:string;exp:number};const key=await crypto.subtle.importKey("raw",enc.encode(e.FORTRESS_SESSION_HMAC_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",key,unb64(parts[2]),enc.encode(parts[0]+"."+parts[1]))||payload.exp<=Date.now()/1000)return res({authenticated:false},401);
 const p=await e.DB.prepare("SELECT p.id,p.tenant_id,p.email,p.display_name,p.role,p.active FROM sessions s JOIN principals p ON p.id=s.principal_id WHERE s.access_jti=? AND s.principal_id=? AND s.revoked_at IS NULL AND s.expires_at>?").bind(payload.jti,payload.sub,Math.floor(Date.now()/1000)).first<{id:string;tenant_id:string;email:string;display_name:string;role:Role;active:number}>();
 if(!p||!p.active)return res({authenticated:false},401);return res({authenticated:true,principal:{id:p.id,tenantId:p.tenant_id,email:p.email,displayName:p.display_name,role:p.role}});
 }catch{return res({authenticated:false},401);}
}
export default {async fetch(r:Request,e:Env):Promise<Response>{const u=new URL(r.url),p=u.pathname;if(p==="/health"&&r.method==="GET")return res({service:"FORTRESS Identity Issuer",status:"ready"});if(p==="/auth/bootstrap"&&r.method==="POST")return bootstrap(r,e);if(p==="/auth/login"&&r.method==="POST")return login(r,e);if(p==="/auth/refresh"&&r.method==="POST")return refresh(r,e);if(p==="/auth/logout"&&r.method==="POST")return logout(r,e);if(p==="/auth/me"&&r.method==="GET")return me(r,e);return res({error:"Not found"},404);}};