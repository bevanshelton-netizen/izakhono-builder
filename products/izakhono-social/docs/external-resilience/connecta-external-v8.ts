import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COOKIE = "__Host-connecta_session";
const te = new TextEncoder();

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin",
      ...extra,
    },
  });
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c] as string));
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase().slice(0, 254);
}
function normalizeHandle(v: unknown) {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, "").slice(0, 40);
}
function validHandle(v: string) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(v);
}
function slugify(v: unknown) {
  return String(v ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(p);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function sha256Text(value: string) {
  const out = await crypto.subtle.digest("SHA-256", te.encode(value));
  return [...new Uint8Array(out)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function derivePassword(password: string, saltEncoded: string) {
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: fromB64url(saltEncoded),
    iterations: 210000,
  }, key, 256);
  return b64url(new Uint8Array(bits));
}
async function makePassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltEncoded = b64url(salt);
  return { salt: saltEncoded, hash: await derivePassword(password, saltEncoded) };
}
function timingSafe(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function token() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}
function inviteCode() {
  return "C-" + b64url(crypto.getRandomValues(new Uint8Array(7))).toUpperCase();
}
function parseCookies(req: Request) {
  const out: Record<string,string> = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSessionCookie(sessionToken: string) {
  return `${COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
function clientBucket(req: Request) {
  const raw = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim().slice(0, 100);
  return raw;
}
async function rateLimit(req: Request, kind: string, limit: number, seconds: number) {
  const bucket = await sha256Text(kind + ":" + clientBucket(req));
  const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
  await db.from("connecta_rate_events").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString());
  const { count, error } = await db.from("connecta_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucket)
    .gte("created_at", cutoff);
  if (error) throw error;
  if ((count || 0) >= limit) return false;
  const ins = await db.from("connecta_rate_events").insert({ bucket_key: bucket });
  if (ins.error) throw ins.error;
  return true;
}

function moderate(text: string) {
  const s = text.toLowerCase();
  const publicInterest = /\b(report|reporting|prevention|protect|safety|news|education|recovery|research|awareness)\b/.test(s);
  const childExploit = /\b(child|minor|underage)\b.{0,45}\b(nude|nudes|porn|sexual|explicit)\b|\b(csam|child porn)\b/.test(s);
  if (childExploit) return { action: publicInterest ? "review" : "block", category: "child-sexual-exploitation" };
  const drugSale = /(sell|buy|deliver|dealer|dm me|for sale).{0,45}(cocaine|heroin|meth|tik|nyaope|mandrax)|(cocaine|heroin|meth|tik|nyaope|mandrax).{0,45}(sell|buy|deliver|dealer|dm me|for sale)/.test(s);
  if (drugSale) return { action: publicInterest ? "review" : "block", category: "illegal-drug-sales" };
  const gangRecruit = /(join|recruit|initiat).{0,35}(gang|criminal crew)|(gang|criminal crew).{0,35}(join|recruit|initiat)/.test(s);
  if (gangRecruit) return { action: publicInterest ? "review" : "block", category: "criminal-recruitment" };
  const pornPromo = /(porn|pornography|explicit sex).{0,35}(link|site|video|sell|buy|watch|subscribe)/.test(s);
  if (pornPromo) return { action: publicInterest ? "review" : "block", category: "pornography-promotion" };
  const threat = /\b(i|we)\s+(will|am going to|gonna)\s+(kill|shoot|stab|hurt|attack)\b/.test(s);
  if (threat) return { action: "block", category: "violent-threat" };
  const doxx = /\b(post|publish|leak|share)\b.{0,35}\b(home address|private address|phone number)\b/.test(s);
  if (doxx) return { action: "block", category: "doxxing" };
  return { action: "allow", category: "" };
}

async function createSession(accountId: string) {
  const sessionToken = token();
  const tokenHash = await sha256Text(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await db.from("connecta_sessions").insert({
    token_hash: tokenHash, account_id: accountId, expires_at: expiresAt
  });
  if (error) throw error;
  return sessionToken;
}

async function auth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const raw = bearer || parseCookies(req)[COOKIE];
  if (!raw) return null;
  const tokenHash = await sha256Text(raw);
  const { data: session, error } = await db.from("connecta_sessions")
    .select("account_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return null;
  const { data: account } = await db.from("connecta_accounts")
    .select("id,email,handle,display_name,status,created_at")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!account || account.status !== "active") return null;
  await db.from("connecta_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", tokenHash);
  return { account, tokenHash };
}

async function disableForViolation(accountId: string, tokenHash: string, category: string) {
  await db.from("connecta_accounts").update({ status: "disabled", updated_at: new Date().toISOString() }).eq("id", accountId);
  await db.from("connecta_sessions").update({ revoked_at: new Date().toISOString() }).eq("account_id", accountId);
  await db.from("connecta_notifications").insert({
    account_id: accountId,
    kind: "safety_enforcement",
    title: "CONNECTA safety enforcement",
    body: `Account disabled after an automatic zero-tolerance safety match: ${category}. A human review path will be added to the external bridge; the owned CONNECTA engine remains authoritative.`
  });
  await db.from("connecta_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", tokenHash);
}

async function api(req: Request, action: string) {
  if (action === "health") {
    const { error } = await db.from("connecta_accounts").select("id", { head: true, count: "exact" }).limit(1);
    return json({
      ok: !error,
      service: "CONNECTA External Resilience",
      route: "supabase-edge",
      database: error ? "error" : "ok",
      providerIndependentPrimary: "IZAKHONO NODE01",
      behaviouralTracking: false,
      advertisingIds: false
    }, error ? 503 : 200);
  }

  if (action === "register" && req.method === "POST") {
    if (!(await rateLimit(req, "register", 8, 3600))) return json({ ok:false, error:"Too many registration attempts" }, 429);
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const handle = normalizeHandle(body.handle);
    const displayName = String(body.displayName ?? "").trim().slice(0, 100);
    const password = String(body.password ?? "");
    if (!email.includes("@")) return json({ok:false,error:"Valid email required"},400);
    if (!validHandle(handle)) return json({ok:false,error:"Handle must be 3–40 characters using letters, numbers, dot, underscore or hyphen"},400);
    if (!displayName) return json({ok:false,error:"Display name required"},400);
    if (password.length < 12) return json({ok:false,error:"Password must be at least 12 characters"},400);

    const [{ data: byEmail }, { data: byHandle }] = await Promise.all([
      db.from("connecta_accounts").select("id").eq("email", email).maybeSingle(),
      db.from("connecta_accounts").select("id").eq("handle", handle).maybeSingle()
    ]);
    if (byEmail || byHandle) return json({ok:false,error:"Email or handle already registered"},409);

    const p = await makePassword(password);
    const { data: account, error } = await db.from("connecta_accounts").insert({
      email, handle, display_name: displayName, password_salt: p.salt, password_hash: p.hash
    }).select("id,email,handle,display_name,status,created_at").single();
    if (error) return json({ok:false,error:"Could not create account"},500);

    await db.from("connecta_notifications").insert({
      account_id: account.id,
      kind: "welcome",
      title: "Welcome to CONNECTA",
      body: "Your profile is live. Join or create a community and publish your first meaningful post."
    });
    const sessionToken = await createSession(account.id);

    const invite = String(body.inviteCode ?? "").trim().toUpperCase();
    if (invite) await redeemInvite(account.id, invite);

    return json({ok:true,account,sessionToken},201,{"set-cookie":setSessionCookie(sessionToken)});
  }

  if (action === "login" && req.method === "POST") {
    if (!(await rateLimit(req, "login", 20, 900))) return json({ok:false,error:"Too many login attempts"},429);
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const { data: account } = await db.from("connecta_accounts")
      .select("id,email,handle,display_name,status,password_salt,password_hash,created_at")
      .eq("email", email).maybeSingle();
    if (!account) return json({ok:false,error:"Invalid credentials"},401);
    const derived = await derivePassword(String(body.password ?? ""), account.password_salt);
    if (!timingSafe(derived, account.password_hash)) return json({ok:false,error:"Invalid credentials"},401);
    if (account.status !== "active") return json({ok:false,error:"Account disabled under CONNECTA safety controls"},423);
    const sessionToken = await createSession(account.id);
    const safeAccount = { id:account.id,email:account.email,handle:account.handle,display_name:account.display_name,status:account.status,created_at:account.created_at };
    return json({ok:true,account:safeAccount,sessionToken},200,{"set-cookie":setSessionCookie(sessionToken)});
  }

  const session = await auth(req);
  if (!session) return json({ok:false,error:"Authentication required"},401,{"set-cookie":clearSessionCookie()});
  const account = session.account;

  if (action === "logout" && req.method === "POST") {
    await db.from("connecta_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", session.tokenHash);
    return json({ok:true},200,{"set-cookie":clearSessionCookie()});
  }
  if (action === "me") return json({ok:true,account});

  if (action === "feed") {
    const url = new URL(req.url);
    const mode = ["balanced","latest","communities"].includes(url.searchParams.get("mode") || "") ? url.searchParams.get("mode")! : "balanced";
    const { data: memberships } = await db.from("connecta_community_members")
      .select("community_id").eq("account_id", account.id).eq("status","active");
    const joined = new Set((memberships || []).map((m:any)=>m.community_id));

    let q = db.from("connecta_posts").select("id,author_id,community_id,body,visibility,moderation_state,created_at")
      .eq("moderation_state","allowed").eq("visibility","public").order("created_at",{ascending:false}).limit(60);
    if (mode === "communities") {
      if (!joined.size) return json({ok:true,mode,posts:[]});
      q = q.in("community_id",[...joined]);
    }
    const { data: posts, error } = await q;
    if (error) return json({ok:false,error:"Could not load feed"},500);
    const authorIds = [...new Set((posts || []).map((p:any)=>p.author_id))];
    const communityIds = [...new Set((posts || []).map((p:any)=>p.community_id).filter(Boolean))];
    const [{ data: authors }, { data: communities }] = await Promise.all([
      authorIds.length ? db.from("connecta_accounts").select("id,handle,display_name").in("id",authorIds) : Promise.resolve({data:[]}),
      communityIds.length ? db.from("connecta_communities").select("id,name,slug").in("id",communityIds) : Promise.resolve({data:[]})
    ]);
    const amap = new Map((authors || []).map((a:any)=>[a.id,a]));
    const cmap = new Map((communities || []).map((c:any)=>[c.id,c]));
    let out = (posts || []).map((p:any)=>({
      ...p,
      handle:amap.get(p.author_id)?.handle || "member",
      display_name:amap.get(p.author_id)?.display_name || "CONNECTA member",
      community:cmap.get(p.community_id) || null,
      relationship_rank:p.community_id && joined.has(p.community_id) ? 2 : 0
    }));
    if (mode === "balanced") out = out.sort((a:any,b:any)=>b.relationship_rank-a.relationship_rank || new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    return json({ok:true,mode,ranking:mode==="balanced"?"Joined communities + recency; no behavioural profile.":"Chronological within the selected scope.",posts:out.slice(0,40)});
  }

  if (action === "post" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const text = String(body.body ?? "").trim().slice(0,8000);
    if (!text) return json({ok:false,error:"Post body required"},400);
    const m = moderate(text);
    if (m.action === "block") {
      await disableForViolation(account.id, session.tokenHash, m.category);
      return json({ok:false,blocked:true,category:m.category,error:"CONNECTA zero-tolerance safety enforcement blocked this content and disabled the account."},423,{"set-cookie":clearSessionCookie()});
    }
    const communityId = body.communityId ? String(body.communityId) : null;
    const state = m.action === "review" ? "review" : "allowed";
    const { data: post, error } = await db.from("connecta_posts").insert({
      author_id:account.id,community_id:communityId,body:text,visibility:"public",moderation_state:state
    }).select("id,body,visibility,moderation_state,created_at,community_id").single();
    if (error) return json({ok:false,error:"Could not publish post"},500);
    return json({ok:true,post,moderation:m},201);
  }

  if (action === "react" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId ?? "");
    const kind = ["appreciate","support","celebrate","insightful"].includes(body.kind) ? body.kind : "appreciate";
    if (!postId) return json({ok:false,error:"postId required"},400);
    const { error } = await db.from("connecta_reactions").upsert({account_id:account.id,post_id:postId,kind},{onConflict:"account_id,post_id,kind"});
    return error ? json({ok:false,error:"Could not react"},500) : json({ok:true,kind});
  }

  if (action === "communities") {
    const { data: communities, error } = await db.from("connecta_communities").select("id,slug,name,description,owner_id,created_at").eq("status","active").order("created_at",{ascending:false}).limit(60);
    if (error) return json({ok:false,error:"Could not load communities"},500);
    const { data: memberships } = await db.from("connecta_community_members").select("community_id").eq("account_id",account.id).eq("status","active");
    const joined = new Set((memberships || []).map((m:any)=>m.community_id));
    return json({ok:true,communities:(communities || []).map((c:any)=>({...c,joined:joined.has(c.id)}))});
  }

  if (action === "community-create" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().slice(0,120);
    const slug = slugify(body.slug || name);
    const description = String(body.description ?? "").trim().slice(0,1000);
    if (!name || !slug) return json({ok:false,error:"Community name required"},400);
    const { data: community, error } = await db.from("connecta_communities").insert({
      owner_id:account.id,slug,name,description
    }).select("id,slug,name,description,owner_id,created_at").single();
    if (error) return json({ok:false,error:error.code==="23505"?"That community name is already in use":"Could not create community"},error.code==="23505"?409:500);
    await db.from("connecta_community_members").insert({community_id:community.id,account_id:account.id,role:"owner",status:"active"});
    return json({ok:true,community},201);
  }

  if (action === "community-join" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const communityId = String(body.communityId ?? "");
    if (!communityId) return json({ok:false,error:"communityId required"},400);
    const { error } = await db.from("connecta_community_members").upsert({
      community_id:communityId,account_id:account.id,role:"member",status:"active"
    },{onConflict:"community_id,account_id"});
    return error ? json({ok:false,error:"Could not join community"},500) : json({ok:true,status:"active"});
  }

  if (action === "invites") {
    const { data: invites, error } = await db.from("connecta_invites").select("id,code,label,max_uses,use_count,expires_at,active,created_at").eq("owner_id",account.id).order("created_at",{ascending:false}).limit(100);
    return error ? json({ok:false,error:"Could not load invites"},500) : json({ok:true,invites});
  }

  if (action === "invite-create" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const label = String(body.label ?? "Founder invite").trim().slice(0,80);
    const code = inviteCode();
    const { data: invite, error } = await db.from("connecta_invites").insert({
      owner_id:account.id,code,label,max_uses:25,expires_at:new Date(Date.now()+30*86400000).toISOString()
    }).select("id,code,label,max_uses,use_count,expires_at,active,created_at").single();
    return error ? json({ok:false,error:"Could not create invite"},500) : json({ok:true,invite},201);
  }

  if (action === "invite-redeem" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();
    const result = await redeemInvite(account.id, code);
    return json(result, result.ok ? 200 : 409);
  }

  if (action === "notifications") {
    const { data: notifications, error } = await db.from("connecta_notifications").select("id,kind,title,body,read_at,created_at").eq("account_id",account.id).order("created_at",{ascending:false}).limit(100);
    return error ? json({ok:false,error:"Could not load notifications"},500) : json({ok:true,notifications});
  }

  if (action === "notification-read" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    const { error } = await db.from("connecta_notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("account_id",account.id);
    return error ? json({ok:false,error:"Could not mark notification"},500) : json({ok:true});
  }

  if (action === "share" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId ?? "");
    const { data: post } = await db.from("connecta_posts").select("id,author_id").eq("id",postId).maybeSingle();
    if (!post) return json({ok:false,error:"Post not found"},404);
    if (post.author_id !== account.id) {
      await db.from("connecta_notifications").insert({
        account_id:post.author_id,kind:"content_shared",title:"Your post was shared",
        body:`@${account.handle} shared your CONNECTA post. Original attribution is preserved.`
      });
    }
    return json({ok:true,ownerAlerted:post.author_id!==account.id});
  }

  if (action === "report" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const targetId = String(body.targetId ?? "");
    const reason = String(body.reason ?? "").trim().slice(0,1500);
    if (!targetId || !reason) return json({ok:false,error:"targetId and reason required"},400);
    const { error } = await db.from("connecta_reports").insert({
      reporter_id:account.id,target_type:"post",target_id:targetId,reason
    });
    return error ? json({ok:false,error:"Could not submit report"},500) : json({ok:true,message:"Safety report submitted for review."},201);
  }


  // IZAKHONO SOCIAL compatibility layer. Additive only: existing CONNECTA actions remain unchanged.
  if (action === "social-me") {
    const { data: profile } = await db.from("connecta_accounts")
      .select("id,email,handle,display_name,bio,avatar_url,banner_url,location,website,verified,account_type,status,created_at")
      .eq("id", account.id).single();
    return json({ok:true,account:profile});
  }

  if (action === "social-feed") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "for-you";
    let q:any = db.from("connecta_posts")
      .select("id,author_id,community_id,body,visibility,moderation_state,parent_post_id,repost_of_id,quote_post_id,language,created_at,edited_at")
      .eq("moderation_state","allowed").eq("visibility","public").order("created_at",{ascending:false}).limit(60);

    if (mode === "following") {
      const { data: following } = await db.from("connecta_follows").select("following_id").eq("follower_id",account.id);
      const ids = (following || []).map((x:any)=>x.following_id);
      if (!ids.length) return json({ok:true,mode,posts:[]});
      q = q.in("author_id",ids);
    }
    const { data: posts, error } = await q;
    if (error) return json({ok:false,error:"Could not load social feed"},500);
    const list = posts || [];
    const postIds = list.map((p:any)=>p.id);
    const authorIds = [...new Set(list.map((p:any)=>p.author_id))];

    const [{data:authors},{data:reactions},{data:replies},{data:reposts},{data:bookmarks}] = await Promise.all([
      authorIds.length ? db.from("connecta_accounts").select("id,handle,display_name,avatar_url,verified,account_type").in("id",authorIds) : Promise.resolve({data:[]}),
      postIds.length ? db.from("connecta_reactions").select("post_id,account_id,kind").in("post_id",postIds) : Promise.resolve({data:[]}),
      postIds.length ? db.from("connecta_posts").select("parent_post_id").in("parent_post_id",postIds).eq("moderation_state","allowed") : Promise.resolve({data:[]}),
      postIds.length ? db.from("connecta_posts").select("repost_of_id").in("repost_of_id",postIds).eq("moderation_state","allowed") : Promise.resolve({data:[]}),
      postIds.length ? db.from("connecta_bookmarks").select("post_id").eq("account_id",account.id).in("post_id",postIds) : Promise.resolve({data:[]})
    ]);
    const amap = new Map((authors || []).map((a:any)=>[a.id,a]));
    const count = (rows:any[],key:string) => {
      const m = new Map<string,number>();
      for (const row of rows || []) { const id=row[key]; if(id)m.set(id,(m.get(id)||0)+1); }
      return m;
    };
    const likes=count(reactions || [],"post_id"), replyCounts=count(replies || [],"parent_post_id"), repostCounts=count(reposts || [],"repost_of_id");
    const myLikes=new Set((reactions || []).filter((r:any)=>r.account_id===account.id && r.kind==="appreciate").map((r:any)=>r.post_id));
    const myBookmarks=new Set((bookmarks || []).map((b:any)=>b.post_id));
    return json({ok:true,mode,posts:list.map((p:any)=>({
      ...p,author:amap.get(p.author_id)||null,
      metrics:{replies:replyCounts.get(p.id)||0,reposts:repostCounts.get(p.id)||0,likes:likes.get(p.id)||0},
      viewer:{liked:myLikes.has(p.id),bookmarked:myBookmarks.has(p.id)}
    }))});
  }

  if (action === "social-post" && req.method === "POST") {
    if (!(await rateLimit(req,"social-post",120,3600))) return json({ok:false,error:"Posting rate limit reached"},429);
    const body = await req.json().catch(()=>({}));
    const text = String(body.body ?? "").trim().slice(0,8000);
    const parentPostId = body.parentPostId ? String(body.parentPostId) : null;
    const repostOfId = body.repostOfId ? String(body.repostOfId) : null;
    const quotePostId = body.quotePostId ? String(body.quotePostId) : null;
    if (!text && !repostOfId) return json({ok:false,error:"Post body required"},400);
    const m = moderate(text);
    if (m.action === "block") return json({ok:false,blocked:true,category:m.category,error:"Content blocked by safety controls"},422);
    const moderationState = m.action === "review" ? "review" : "allowed";
    const {data:post,error} = await db.from("connecta_posts").insert({
      author_id:account.id,body:text || " ",visibility:"public",moderation_state:moderationState,
      parent_post_id:parentPostId,repost_of_id:repostOfId,quote_post_id:quotePostId,
      language:String(body.language || "und").slice(0,20)
    }).select("id,author_id,body,parent_post_id,repost_of_id,quote_post_id,language,created_at,moderation_state").single();
    if (error) return json({ok:false,error:"Could not publish post"},500);
    if (parentPostId) {
      const {data:parent} = await db.from("connecta_posts").select("author_id").eq("id",parentPostId).maybeSingle();
      if (parent && parent.author_id !== account.id) {
        await db.from("connecta_notifications").insert({
          account_id:parent.author_id,kind:"reply",title:"@"+account.handle+" replied to you",body:text.slice(0,180)
        });
      }
    }
    return json({ok:true,post,moderation:m},201);
  }

  if (action === "social-like-toggle" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const postId=String(body.postId||"");
    if(!postId)return json({ok:false,error:"postId required"},400);
    const {data:existing}=await db.from("connecta_reactions").select("post_id")
      .eq("account_id",account.id).eq("post_id",postId).eq("kind","appreciate").maybeSingle();
    if(existing){
      await db.from("connecta_reactions").delete().eq("account_id",account.id).eq("post_id",postId).eq("kind","appreciate");
      return json({ok:true,liked:false});
    }
    const ins=await db.from("connecta_reactions").insert({account_id:account.id,post_id:postId,kind:"appreciate"});
    return ins.error?json({ok:false,error:"Could not like post"},500):json({ok:true,liked:true});
  }

  if (action === "social-bookmark-toggle" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const postId=String(body.postId||"");
    const {data:existing}=await db.from("connecta_bookmarks").select("post_id")
      .eq("account_id",account.id).eq("post_id",postId).maybeSingle();
    if(existing){
      await db.from("connecta_bookmarks").delete().eq("account_id",account.id).eq("post_id",postId);
      return json({ok:true,bookmarked:false});
    }
    const ins=await db.from("connecta_bookmarks").insert({account_id:account.id,post_id:postId});
    return ins.error?json({ok:false,error:"Could not bookmark post"},500):json({ok:true,bookmarked:true});
  }

  if (action === "social-bookmarks") {
    const {data:saved}=await db.from("connecta_bookmarks").select("post_id,created_at")
      .eq("account_id",account.id).order("created_at",{ascending:false}).limit(100);
    const ids=(saved||[]).map((x:any)=>x.post_id);
    if(!ids.length)return json({ok:true,posts:[]});
    const {data:posts}=await db.from("connecta_posts")
      .select("id,author_id,community_id,body,visibility,moderation_state,parent_post_id,repost_of_id,quote_post_id,language,created_at,edited_at")
      .in("id",ids).eq("moderation_state","allowed");
    const authorIds=[...new Set((posts||[]).map((p:any)=>p.author_id))];
    const {data:authors}=authorIds.length?await db.from("connecta_accounts").select("id,handle,display_name,avatar_url,verified,account_type").in("id",authorIds):{data:[]};
    const amap=new Map((authors||[]).map((a:any)=>[a.id,a]));
    const order=new Map(ids.map((id:string,i:number)=>[id,i]));
    const out=(posts||[]).sort((a:any,b:any)=>(order.get(a.id)??999)-(order.get(b.id)??999)).map((p:any)=>({...p,author:amap.get(p.author_id)||null,viewer:{bookmarked:true}}));
    return json({ok:true,posts:out});
  }

  if (action === "social-repost-toggle" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const postId=String(body.postId||"");
    const {data:existing}=await db.from("connecta_posts").select("id").eq("author_id",account.id).eq("repost_of_id",postId).maybeSingle();
    if(existing){
      await db.from("connecta_posts").delete().eq("id",existing.id).eq("author_id",account.id);
      return json({ok:true,reposted:false});
    }
    const ins=await db.from("connecta_posts").insert({author_id:account.id,body:" ",visibility:"public",moderation_state:"allowed",repost_of_id:postId});
    return ins.error?json({ok:false,error:"Could not repost"},500):json({ok:true,reposted:true});
  }

  if (action === "social-follow-toggle" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const targetHandle=normalizeHandle(body.handle);
    const {data:target}=await db.from("connecta_accounts").select("id,handle,display_name")
      .eq("handle",targetHandle).eq("status","active").maybeSingle();
    if(!target)return json({ok:false,error:"Account not found"},404);
    if(target.id===account.id)return json({ok:false,error:"You cannot follow yourself"},400);
    const {data:existing}=await db.from("connecta_follows").select("following_id")
      .eq("follower_id",account.id).eq("following_id",target.id).maybeSingle();
    if(existing){
      await db.from("connecta_follows").delete().eq("follower_id",account.id).eq("following_id",target.id);
      return json({ok:true,following:false});
    }
    const ins=await db.from("connecta_follows").insert({follower_id:account.id,following_id:target.id});
    if(!ins.error)await db.from("connecta_notifications").insert({
      account_id:target.id,kind:"follow",title:"@"+account.handle+" followed you",body:"You have a new follower on IZAKHONO SOCIAL."
    });
    return ins.error?json({ok:false,error:"Could not follow account"},500):json({ok:true,following:true});
  }

  if (action === "social-profile") {
    const url=new URL(req.url);
    const targetHandle=normalizeHandle(url.searchParams.get("handle")||account.handle);
    const {data:profile}=await db.from("connecta_accounts")
      .select("id,handle,display_name,bio,avatar_url,banner_url,location,website,verified,account_type,created_at")
      .eq("handle",targetHandle).eq("status","active").maybeSingle();
    if(!profile)return json({ok:false,error:"Profile not found"},404);
    const [{count:followers},{count:following},{data:followRow},{data:posts}]=await Promise.all([
      db.from("connecta_follows").select("follower_id",{count:"exact",head:true}).eq("following_id",profile.id),
      db.from("connecta_follows").select("following_id",{count:"exact",head:true}).eq("follower_id",profile.id),
      db.from("connecta_follows").select("following_id").eq("follower_id",account.id).eq("following_id",profile.id).maybeSingle(),
      db.from("connecta_posts")
        .select("id,author_id,community_id,body,visibility,moderation_state,parent_post_id,repost_of_id,quote_post_id,language,created_at,edited_at")
        .eq("author_id",profile.id).eq("visibility","public").eq("moderation_state","allowed").order("created_at",{ascending:false}).limit(30)
    ]);
    return json({ok:true,profile,followers:followers||0,following:following||0,isFollowing:!!followRow,posts:posts||[]});
  }

  if (action === "social-profile-update" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const patch:any={updated_at:new Date().toISOString()};
    if(body.displayName!==undefined)patch.display_name=String(body.displayName||"").trim().slice(0,100);
    if(body.bio!==undefined)patch.bio=String(body.bio||"").trim().slice(0,300);
    if(body.location!==undefined)patch.location=String(body.location||"").trim().slice(0,100);
    if(body.website!==undefined)patch.website=String(body.website||"").trim().slice(0,300);
    const {data,error}=await db.from("connecta_accounts").update(patch).eq("id",account.id)
      .select("id,email,handle,display_name,bio,avatar_url,banner_url,location,website,verified,account_type,status,created_at").single();
    return error?json({ok:false,error:"Could not update profile"},500):json({ok:true,account:data});
  }

  if (action === "social-search") {
    const url=new URL(req.url);
    const q=String(url.searchParams.get("q")||"").trim().slice(0,100);
    if(!q)return json({ok:true,accounts:[],posts:[]});
    const term=q.replace(/^[@#]/,"");
    const [{data:accounts},{data:posts}]=await Promise.all([
      db.from("connecta_accounts").select("id,handle,display_name,bio,avatar_url,verified,account_type")
        .eq("status","active").or("handle.ilike.%"+term+"%,display_name.ilike.%"+term+"%").limit(15),
      db.from("connecta_posts").select("id,author_id,body,parent_post_id,repost_of_id,quote_post_id,created_at")
        .eq("visibility","public").eq("moderation_state","allowed").ilike("body","%"+q+"%").order("created_at",{ascending:false}).limit(40)
    ]);
    return json({ok:true,accounts:accounts||[],posts:posts||[]});
  }

  if (action === "social-conversations") {
    const {data:memberships}=await db.from("connecta_conversation_members").select("conversation_id,last_read_at").eq("account_id",account.id);
    const ids=(memberships||[]).map((m:any)=>m.conversation_id);
    if(!ids.length)return json({ok:true,conversations:[]});
    const [{data:conversations},{data:members}]=await Promise.all([
      db.from("connecta_conversations").select("id,kind,title,created_by,created_at,updated_at").in("id",ids).order("updated_at",{ascending:false}),
      db.from("connecta_conversation_members").select("conversation_id,account_id,role").in("conversation_id",ids)
    ]);
    const accountIds=[...new Set((members||[]).map((m:any)=>m.account_id))];
    const {data:people}=accountIds.length?await db.from("connecta_accounts").select("id,handle,display_name,avatar_url,verified").in("id",accountIds):{data:[]};
    const pmap=new Map((people||[]).map((p:any)=>[p.id,p]));
    return json({ok:true,conversations:(conversations||[]).map((c:any)=>({
      ...c,members:(members||[]).filter((m:any)=>m.conversation_id===c.id).map((m:any)=>({...m,account:pmap.get(m.account_id)||null}))
    }))});
  }

  if (action === "social-conversation-create" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const targetHandle=normalizeHandle(body.handle);
    const {data:target}=await db.from("connecta_accounts").select("id,handle,display_name,avatar_url,verified")
      .eq("handle",targetHandle).eq("status","active").maybeSingle();
    if(!target||target.id===account.id)return json({ok:false,error:"Valid recipient required"},400);
    const {data:conversation,error}=await db.from("connecta_conversations").insert({kind:"direct",created_by:account.id})
      .select("id,kind,title,created_at").single();
    if(error)return json({ok:false,error:"Could not create conversation"},500);
    const members=[
      {conversation_id:conversation.id,account_id:account.id,role:"owner"},
      {conversation_id:conversation.id,account_id:target.id,role:"member"}
    ];
    const ins=await db.from("connecta_conversation_members").insert(members);
    return ins.error?json({ok:false,error:"Could not add conversation members"},500):json({ok:true,conversation,target},201);
  }

  if (action === "social-messages") {
    const url=new URL(req.url);
    const conversationId=String(url.searchParams.get("conversationId")||"");
    const {data:member}=await db.from("connecta_conversation_members").select("conversation_id")
      .eq("conversation_id",conversationId).eq("account_id",account.id).maybeSingle();
    if(!member)return json({ok:false,error:"Conversation not found"},404);
    const {data:messages}=await db.from("connecta_messages")
      .select("id,conversation_id,sender_id,body,created_at,edited_at").eq("conversation_id",conversationId)
      .eq("moderation_state","allowed").order("created_at",{ascending:true}).limit(200);
    const senderIds=[...new Set((messages||[]).map((m:any)=>m.sender_id))];
    const {data:senders}=senderIds.length?await db.from("connecta_accounts").select("id,handle,display_name,avatar_url,verified").in("id",senderIds):{data:[]};
    const smap=new Map((senders||[]).map((s:any)=>[s.id,s]));
    await db.from("connecta_conversation_members").update({last_read_at:new Date().toISOString()})
      .eq("conversation_id",conversationId).eq("account_id",account.id);
    return json({ok:true,messages:(messages||[]).map((m:any)=>({...m,sender:smap.get(m.sender_id)||null}))});
  }

  if (action === "social-message-send" && req.method === "POST") {
    const body=await req.json().catch(()=>({}));
    const conversationId=String(body.conversationId||"");
    const text=String(body.body||"").trim().slice(0,8000);
    const {data:member}=await db.from("connecta_conversation_members").select("conversation_id")
      .eq("conversation_id",conversationId).eq("account_id",account.id).maybeSingle();
    if(!member||!text)return json({ok:false,error:"Conversation and message required"},400);
    const m=moderate(text);
    if(m.action==="block")return json({ok:false,blocked:true,category:m.category,error:"Message blocked by safety controls"},422);
    const {data:message,error}=await db.from("connecta_messages").insert({
      conversation_id:conversationId,sender_id:account.id,body:text,moderation_state:m.action==="review"?"review":"allowed"
    }).select("id,conversation_id,sender_id,body,created_at").single();
    await db.from("connecta_conversations").update({updated_at:new Date().toISOString()}).eq("id",conversationId);
    return error?json({ok:false,error:"Could not send message"},500):json({ok:true,message},201);
  }

  return json({ok:false,error:"Unknown action"},404);
}

async function redeemInvite(accountId: string, code: string) {
  if (!code) return {ok:false,error:"Invite code required"};
  const { data: invite } = await db.from("connecta_invites").select("id,owner_id,active,max_uses,use_count,expires_at").eq("code",code).maybeSingle();
  if (!invite || !invite.active || new Date(invite.expires_at).getTime() <= Date.now() || invite.use_count >= invite.max_uses) return {ok:false,error:"Invite code is invalid or expired"};
  const { data: existing } = await db.from("connecta_invite_redemptions").select("invite_id").eq("invite_id",invite.id).eq("account_id",accountId).maybeSingle();
  if (existing) return {ok:true,alreadyRedeemed:true};
  const ins = await db.from("connecta_invite_redemptions").insert({invite_id:invite.id,account_id:accountId});
  if (ins.error) return {ok:false,error:"Invite could not be redeemed"};
  await db.from("connecta_invites").update({use_count:invite.use_count+1}).eq("id",invite.id);
  return {ok:true,inviterId:invite.owner_id};
}

function html() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CONNECTA — People. Communities. Connected.</title>
<meta name="description" content="CONNECTA is a privacy-first social network built around real relationships and communities.">
<style>
:root{--bg:#f3f7f5;--paper:#fff;--ink:#10231e;--muted:#687c75;--line:#dbe6e1;--green:#0f6a56;--deep:#082f28;--mint:#dff1eb;--gold:#d5a642;--danger:#8c3028}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}button,input,textarea,select{font:inherit}button{cursor:pointer}.hidden{display:none!important}.top{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:13px 24px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.brandWrap{display:flex;gap:10px;align-items:center}.mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,var(--deep),var(--green));color:#fff;display:grid;place-items:center;font-weight:950}.brand{font-weight:950;letter-spacing:.06em}.tag{font-size:10px;color:var(--muted);margin-top:2px}.status{font-size:11px;color:var(--green);font-weight:850}.status:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#2c9a71;margin-right:7px;box-shadow:0 0 0 5px rgba(44,154,113,.1)}.userbar{justify-self:end;display:flex;align-items:center;gap:9px}.pill{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font-size:11px;font-weight:850}.privacy{padding:9px 20px;text-align:center;background:var(--deep);color:#d7eee6;font-size:11px}.privacy b{color:#fff}.auth{min-height:calc(100vh - 105px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(340px,500px);gap:55px;align-items:center;max-width:1250px;margin:auto;padding:54px 30px}.eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:var(--green)}.auth h1{font-size:clamp(42px,6vw,76px);letter-spacing:-.06em;line-height:.96;margin:12px 0 20px}.auth h1 span{color:var(--green)}.lead{font-size:17px;line-height:1.65;color:#52665f;max-width:720px}.promise{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}.promise div{background:#fff;border:1px solid var(--line);border-radius:18px;padding:17px}.promise b{font-size:12px}.promise p{font-size:11px;color:var(--muted);line-height:1.5;margin:5px 0}.authcard{background:#fff;border:1px solid var(--line);border-radius:28px;padding:27px;box-shadow:0 30px 80px rgba(13,64,51,.11)}.tabs{display:grid;grid-template-columns:1fr 1fr;background:#eff5f2;padding:4px;border-radius:13px;margin-bottom:22px}.tabs button{border:0;background:transparent;border-radius:10px;padding:10px;font-weight:850;color:var(--muted)}.tabs button.active{background:#fff;color:var(--green);box-shadow:0 3px 10px rgba(0,0,0,.07)}.authcard h2{font-size:29px;letter-spacing:-.04em}.form{display:grid;gap:12px}.form label{display:grid;gap:5px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:850;color:#5c6f69}.form input,.form textarea{border:1px solid var(--line);background:#fbfcfb;border-radius:12px;padding:12px;outline:none}.form input:focus,.form textarea:focus{border-color:#9ac7b9;box-shadow:0 0 0 3px rgba(15,106,86,.08)}.primary{border:0;background:var(--green);color:#fff;border-radius:12px;padding:12px 15px;font-weight:900}.fine{font-size:10px;color:#81918b;line-height:1.5}.msg{margin-top:12px;border-radius:11px;padding:10px 12px;background:#fff1ef;color:var(--danger);font-size:11px}.shell{display:grid;grid-template-columns:240px minmax(0,720px) 300px;gap:18px;max-width:1320px;margin:0 auto;padding:22px}.rail,.side{display:grid;align-content:start;gap:12px}.nav{background:#fff;border:1px solid var(--line);border-radius:18px;padding:9px}.nav button{width:100%;text-align:left;border:0;background:transparent;border-radius:11px;padding:11px;color:#52665f;font-weight:800;font-size:12px}.nav button.active{background:var(--mint);color:var(--green)}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:17px}.card h3{margin:5px 0 8px;font-size:15px}.card p{color:var(--muted);font-size:11px;line-height:1.5}.feed{display:grid;align-content:start;gap:12px}.hero{background:linear-gradient(135deg,#082f28,#0f6a56);color:#fff;border-radius:22px;padding:25px}.hero h1{font-size:34px;letter-spacing:-.045em;margin:7px 0}.hero p{color:#cfe7df;line-height:1.55;margin:0}.composer{background:#fff;border:1px solid var(--line);border-radius:18px;padding:15px}.composer textarea{width:100%;min-height:100px;resize:vertical;border:0;outline:0;font-size:14px}.row{display:flex;gap:9px;align-items:center;justify-content:space-between}.select{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;color:var(--muted);font-size:11px}.post{background:#fff;border:1px solid var(--line);border-radius:18px;padding:17px}.posthead{display:flex;justify-content:space-between;gap:12px}.who{display:flex;gap:10px}.avatar{width:39px;height:39px;border-radius:50%;background:linear-gradient(145deg,#d7eee6,#b9d8ce);display:grid;place-items:center;font-size:11px;font-weight:950;color:var(--green)}.who b{font-size:12px}.who span,.meta{font-size:10px;color:var(--muted)}.body{font-size:14px;line-height:1.6;white-space:pre-wrap;margin:15px 0}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;border-top:1px solid var(--line);padding-top:10px}.actions button{border:0;background:#f6f8f7;border-radius:10px;padding:9px;font-size:10px;font-weight:850;color:#536861}.sectionTitle{background:#fff;border:1px solid var(--line);border-radius:18px;padding:19px}.sectionTitle h2{margin:5px 0;font-size:28px}.grid{display:grid;gap:10px}.community{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;display:grid;grid-template-columns:1fr auto;gap:12px}.community h3{font-size:13px;margin:0}.community p{font-size:11px;color:var(--muted);margin:6px 0 0}.community button,.smallbtn{border:1px solid #b9d2c9;background:#fff;color:var(--green);font-weight:850;border-radius:9px;padding:8px 10px;font-size:10px}.notice{background:#fff;border:1px solid var(--line);border-radius:15px;padding:14px;text-align:left;width:100%}.notice.unread{border-color:#9ac7b9}.notice b{font-size:12px}.notice p{font-size:11px;color:var(--muted);line-height:1.45}.invite{background:#fff;border:1px solid var(--line);border-radius:15px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.invite code{font-weight:900}.global{background:var(--mint);color:#315d51;border:1px solid #c5ded5;border-radius:12px;padding:10px 12px;font-size:11px;display:flex;justify-content:space-between}.empty{text-align:center;background:#fff;border:1px dashed #cbdad4;border-radius:18px;padding:25px;color:var(--muted);font-size:12px}.safety span{display:block;padding:6px 0;border-bottom:1px solid var(--line);font-size:10px;color:#50645e}.safety span:last-child{border:0}@media(max-width:1040px){.shell{grid-template-columns:200px 1fr}.side{display:none}.top{grid-template-columns:1fr auto}.status{display:none}.auth{grid-template-columns:1fr;max-width:760px}}@media(max-width:720px){.shell{grid-template-columns:1fr;padding:12px}.rail{display:none}.auth{padding:30px 18px}.promise{grid-template-columns:1fr}.authcard{padding:20px}.top{padding:10px 14px}.userbar .pill:first-child{display:none}.hero h1{font-size:29px}}
</style></head><body>
<header class="top"><div class="brandWrap"><span class="mark">C</span><span><div class="brand">CONNECTA</div><div class="tag">People. Communities. Connected.</div></span></div><div class="status">External resilience route</div><div class="userbar"><button id="userPill" class="pill hidden"></button><button id="logout" class="pill hidden">Sign out</button></div></header>
<div class="privacy"><b>People, not profiling.</b> No advertising IDs. No behavioural tracking. Owned NODE01 remains the primary authority.</div>

<section id="auth" class="auth">
<div><div class="eyebrow">CONNECTA external launch bridge</div><h1>Real people.<br><span>Real communities.</span></h1><p class="lead">A privacy-first social network built around relationships and communities, with explicit feed controls and zero-tolerance safety enforcement for abuse, criminal recruitment and child sexual exploitation.</p><div class="promise"><div><b>HTTP-only sessions</b><p>Your login token is never placed in browser storage.</p></div><div><b>No surveillance growth</b><p>No ad IDs, cross-site profiling or engagement addiction scoring.</p></div><div><b>Safety enforced</b><p>Threats, doxxing, drug sales, pornography promotion and criminal recruitment are blocked.</p></div><div><b>Owned-first</b><p>This external route is reversible. IZAKHONO NODE01 remains primary.</p></div></div></div>
<div class="authcard"><div class="tabs"><button id="tabRegister" class="active">Create account</button><button id="tabLogin">Sign in</button></div><div class="eyebrow" id="authEyebrow">Founder access</div><h2 id="authTitle">Join CONNECTA</h2><form id="authForm" class="form"><label id="nameLabel">Display name<input id="displayName" maxlength="100"></label><label id="handleLabel">Handle<input id="handle" maxlength="40" placeholder="your.handle"></label><label>Email<input id="email" type="email" required></label><label>Password<input id="password" type="password" minlength="12" required></label><button class="primary" id="authSubmit">Create my CONNECTA account</button></form><div id="authMsg" class="msg hidden"></div><p class="fine">This external bridge uses an encrypted HTTPS connection and a secure HTTP-only cookie. The database service credential remains server-side.</p></div>
</section>

<section id="app" class="shell hidden">
<aside class="rail"><div class="nav"><button data-panel="home" class="active">Home</button><button data-panel="communities">Communities</button><button data-panel="notifications">Notifications</button><button data-panel="invites">Invite people</button></div><div class="card"><div class="eyebrow">Your feed</div><h3>You choose the signal.</h3><select id="feedMode" class="select"><option value="balanced">Balanced</option><option value="latest">Latest</option><option value="communities">Communities</option></select><p>Balanced uses only your joined communities plus recency—not a behavioural profile.</p></div></aside>
<main class="feed"><div id="globalMsg" class="global hidden"><span></span><button class="smallbtn">×</button></div><div id="panel"></div></main>
<aside class="side"><div class="card safety"><div class="eyebrow">Safety Centre</div><h3>Clean social, enforced.</h3><span>No cyberbullying or threats</span><span>No doxxing</span><span>No drugs or porn promotion</span><span>No criminal recruitment</span><span>Zero tolerance for child sexual exploitation</span></div><div class="card"><div class="eyebrow">Route status</div><h3>External HTTPS bridge</h3><p>This route exists to get CONNECTA publicly reachable while the owned NODE01 + EDGE/TLS + DNS route is activated. It does not replace the owned engine.</p></div></aside>
</section>

<script>
const base='/functions/v1/connecta-external'; let mode='register', account=null, panel='home', inviteCode=new URLSearchParams(location.search).get('invite')||'';
const $=id=>document.getElementById(id);
async function call(action,opts={}){const parts=String(action).split('&');const primary=parts.shift();const query=parts.length?'&'+parts.join('&'):'';const sessionToken=sessionStorage.getItem('connecta_external_session')||'';const r=await fetch(base+'?action='+encodeURIComponent(primary)+query,{credentials:'omit',cache:'no-store',...opts,headers:{accept:'application/json',...(opts.body?{'content-type':'application/json'}:{}),...(sessionToken?{authorization:'Bearer '+sessionToken}:{}),...(opts.headers||{})}});const d=await r.json().catch(()=>({ok:false,error:'Invalid response'}));return {r,d}}
function showMsg(t){$('globalMsg').classList.remove('hidden');$('globalMsg').querySelector('span').textContent=t}
$('globalMsg').querySelector('button').onclick=()=>$('globalMsg').classList.add('hidden');
function initials(s){return (s||'C').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
function when(v){const n=Date.now()-new Date(v).getTime(),m=Math.floor(n/60000);if(m<1)return'now';if(m<60)return m+' min';const h=Math.floor(m/60);if(h<24)return h+' hr';return Math.floor(h/24)+' d'}
function setMode(next){mode=next;const reg=mode==='register';$('tabRegister').classList.toggle('active',reg);$('tabLogin').classList.toggle('active',!reg);$('nameLabel').classList.toggle('hidden',!reg);$('handleLabel').classList.toggle('hidden',!reg);$('authEyebrow').textContent=reg?'Founder access':'Welcome back';$('authTitle').textContent=reg?'Join CONNECTA':'Sign in to CONNECTA';$('authSubmit').textContent=reg?'Create my CONNECTA account':'Sign in';$('authMsg').classList.add('hidden')}
$('tabRegister').onclick=()=>setMode('register');$('tabLogin').onclick=()=>setMode('login');
$('authForm').onsubmit=async e=>{e.preventDefault();$('authSubmit').disabled=true;$('authMsg').classList.add('hidden');const body={email:$('email').value,password:$('password').value};if(mode==='register'){body.displayName=$('displayName').value;body.handle=$('handle').value;body.inviteCode=inviteCode}const {r,d}=await call(mode,{method:'POST',body:JSON.stringify(body)});$('authSubmit').disabled=false;if(!r.ok){$('authMsg').textContent=d.error||'Could not continue';$('authMsg').classList.remove('hidden');return}if(d.sessionToken)sessionStorage.setItem('connecta_external_session',d.sessionToken);await boot()}
$('logout').onclick=async()=>{await call('logout',{method:'POST'});sessionStorage.removeItem('connecta_external_session');account=null;$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('logout').classList.add('hidden');$('userPill').classList.add('hidden')}
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{panel=b.dataset.panel;document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('feedMode').onchange=()=>renderHome();
async function boot(){const {r,d}=await call('me');if(!r.ok){$('auth').classList.remove('hidden');$('app').classList.add('hidden');return}account=d.account;$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('logout').classList.remove('hidden');$('userPill').classList.remove('hidden');$('userPill').textContent='@'+account.handle;await render()}
async function render(){if(panel==='home')return renderHome();if(panel==='communities')return renderCommunities();if(panel==='notifications')return renderNotifications();if(panel==='invites')return renderInvites()}
async function renderHome(){const {d}=await call('feed&mode='+$('feedMode').value);const posts=d.posts||[];$('panel').innerHTML='<div class="hero"><div class="eyebrow" style="color:#a9dbcc">Founder network</div><h1>Welcome, '+esc(account.display_name.split(' ')[0])+'.</h1><p>Build your real community. This route is using real external persistence—no fake feed or seed users.</p></div><form id="composer" class="composer"><textarea id="draft" maxlength="8000" placeholder="Share something meaningful…"></textarea><div class="row"><span class="meta">Public post · safety enforced server-side</span><button class="primary">Post</button></div></form><div id="posts"></div>';$('composer').onsubmit=async e=>{e.preventDefault();const body=$('draft').value.trim();if(!body)return;const {r,d}=await call('post',{method:'POST',body:JSON.stringify({body})});if(!r.ok){showMsg(d.error||'Post blocked');if(r.status===423)return location.reload();return}$('draft').value='';showMsg(d.post.moderation_state==='review'?'Post held for review.':'Published.');renderHome()};$('posts').innerHTML=posts.length?posts.map(postHtml).join(''):'<div class="empty">Your real feed starts here. Join a community and publish the first post.</div>';document.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>call('react',{method:'POST',body:JSON.stringify({postId:b.dataset.react,kind:'appreciate'})}).then(()=>showMsg('Appreciated.')));document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>call('share',{method:'POST',body:JSON.stringify({postId:b.dataset.share})}).then(({d})=>showMsg(d.ownerAlerted?'Shared. Original owner alerted.':'Shared.')));document.querySelectorAll('[data-report]').forEach(b=>b.onclick=async()=>{const reason=prompt('Describe the safety concern.');if(!reason)return;const {d}=await call('report',{method:'POST',body:JSON.stringify({targetId:b.dataset.report,reason})});showMsg(d.message||d.error||'Report submitted')})}
function postHtml(p){return '<article class="post"><div class="posthead"><div class="who"><span class="avatar">'+initials(p.display_name)+'</span><div><b>'+esc(p.display_name)+'</b><br><span>@'+esc(p.handle)+' · '+when(p.created_at)+(p.community?' · '+esc(p.community.name):'')+'</span></div></div><span class="meta">'+esc(p.visibility)+'</span></div><div class="body">'+esc(p.body)+'</div><div class="actions"><button data-react="'+p.id+'">♡ Appreciate</button><button data-share="'+p.id+'">↗ Share</button><button data-report="'+p.id+'">⚑ Report</button></div></article>'}
async function renderCommunities(){const {d}=await call('communities');const list=d.communities||[];$('panel').innerHTML='<div class="sectionTitle"><div class="eyebrow">Relationship-led growth</div><h2>Communities</h2><p>Create or join a real public community.</p></div><form id="communityForm" class="composer"><input id="communityName" class="select" style="width:100%;margin-bottom:9px" placeholder="Community name" required><textarea id="communityDesc" placeholder="What is this community for?"></textarea><button class="primary">Create community</button></form><div id="communities" class="grid">'+(list.length?list.map(c=>'<article class="community"><div><h3>'+esc(c.name)+'</h3><p>@'+esc(c.slug)+' · '+esc(c.description||'A CONNECTA community.')+'</p></div><button data-join="'+c.id+'" '+(c.joined?'disabled':'')+'>'+(c.joined?'Joined':'Join')+'</button></article>').join(''):'<div class="empty">No public communities yet. Become the first founder.</div>')+'</div>';$('communityForm').onsubmit=async e=>{e.preventDefault();const {r,d}=await call('community-create',{method:'POST',body:JSON.stringify({name:$('communityName').value,description:$('communityDesc').value})});showMsg(r.ok?'Community created.':d.error||'Could not create community');if(r.ok)renderCommunities()};document.querySelectorAll('[data-join]').forEach(b=>b.onclick=async()=>{const {r,d}=await call('community-join',{method:'POST',body:JSON.stringify({communityId:b.dataset.join})});showMsg(r.ok?'Community joined.':d.error||'Could not join');if(r.ok)renderCommunities()})}
async function renderNotifications(){const {d}=await call('notifications');const list=d.notifications||[];$('panel').innerHTML='<div class="sectionTitle"><div class="eyebrow">First-party alerts</div><h2>Notifications</h2><p>Safety and relationship alerts stay inside CONNECTA and are not used for advertising profiles.</p></div><div class="grid">'+(list.length?list.map(n=>'<button class="notice '+(n.read_at?'':'unread')+'" data-notice="'+n.id+'"><span class="meta">'+esc(n.kind.replaceAll('_',' '))+' · '+when(n.created_at)+'</span><br><b>'+esc(n.title)+'</b><p>'+esc(n.body)+'</p></button>').join(''):'<div class="empty">No notifications yet.</div>')+'</div>';document.querySelectorAll('[data-notice]').forEach(b=>b.onclick=async()=>{await call('notification-read',{method:'POST',body:JSON.stringify({id:b.dataset.notice})});renderNotifications()})}
async function renderInvites(){const {d}=await call('invites');const list=d.invites||[];$('panel').innerHTML='<div class="sectionTitle"><div class="eyebrow">Founder programme</div><h2>Invite real people</h2><p>User-controlled invitations only—never scraped or spammed.</p></div><form id="inviteForm" class="composer"><input id="inviteLabel" class="select" style="width:100%;margin-bottom:9px" value="Founder invite"><button class="primary">Create 30-day invite</button></form><div class="grid">'+(list.length?list.map(i=>'<div class="invite"><div><span class="meta">'+esc(i.label)+'</span><br><code>'+esc(i.code)+'</code></div><button class="smallbtn" data-copy="'+esc(i.code)+'">Copy link</button></div>').join(''):'<div class="empty">No founder invites yet.</div>')+'</div>';$('inviteForm').onsubmit=async e=>{e.preventDefault();const {r,d}=await call('invite-create',{method:'POST',body:JSON.stringify({label:$('inviteLabel').value})});showMsg(r.ok?'Invite created.':d.error||'Could not create invite');if(r.ok)renderInvites()};document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const u=location.origin+location.pathname+'?invite='+encodeURIComponent(b.dataset.copy);try{await navigator.clipboard.writeText(u);showMsg('Invite link copied.')}catch{prompt('Copy invite link:',u)}})}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
boot();
</script><a id="izakhono-one-founding-promo" href="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one-public" target="_blank" rel="noopener" style="position:fixed;left:14px;bottom:14px;z-index:9999;padding:10px 14px;border-radius:999px;background:#d4ad4c;color:#17342e;text-decoration:none;font:900 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.24)">IZAKHONO ONE · Founding 1,000 →</a></body></html>`;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }});
    }
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action) return await api(req, action);
    if (req.method !== "GET") return json({ok:false,error:"Method not allowed"},405);
    return new Response(html(), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
      }
    });
  } catch (error) {
    console.error("CONNECTA external failure", error);
    return json({ok:false,error:"CONNECTA external route error"},500);
  }
});